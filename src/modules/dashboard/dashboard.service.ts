import axios from "axios";
import env from "../../config/env";

export interface DashboardStats {
  totalParticipations: number;
  uniqueParticipants: number;
  prizesWon: number;
  remainingPrizes: number;
  participantsByStatus: {
    tourist: number;
    resident: number;
  };
  participantsByPrize: { [key: string]: number };
  participantsByCountry: { [key: string]: number };
  participantsByDevice: {
    mobile: number;
    desktop: number;
    tablet: number;
    other: number;
  };
  participationTrend: { date: string; count: number }[];
  dayOfWeekTrend: { day: string; count: number }[];
  hourOfDayTrend: { date: string; hour: number; count: number }[];
  prizes: {
    name: string;
    total: number;
    given: number;
    remaining: number;
  }[];
  conversionRate: number;
  recentActivity: {
    time: string;
    action: string;
    details: string;
  }[];
}

class DashboardService {
  private detectDevice(userAgent: string): "mobile" | "desktop" | "tablet" | "other" {
    const ua = userAgent?.toLowerCase?.() || "";
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "mobile";
    if (ua.includes("tablet") || ua.includes("ipad")) return "tablet";
    if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) return "desktop";
    return "other";
  }

  private async fetchPromotions(): Promise<any[]> {
    try {
      const response = await axios.get(env.EASY_PROMO_PROMOTION_FETCH_URL, {
        headers: { Authorization: `Bearer ${env.EASY_PROMO_API_KEY}` },
      });
      const promotions = response.data?.items || [];
      return promotions;
    } catch (error) {
      console.error("Error fetching promotions:", error);
      return [];
    }
  }

  private async fetchParticipants(promo_id: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${env.EASY_PROMO_PARTICIPATION_FETCH_URL}/${promo_id}?format=full`,
        { headers: { Authorization: `Bearer ${env.EASY_PROMO_API_KEY}` } }
      );
      return response.data?.items || [];
    } catch (error) {
      console.error(`Error fetching participants for promo ${promo_id}:`, error);
      return [];
    }
  }

  private async fetchUniqueParticipants(promo_id: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${env.EASY_PROMO_UNIQUE_PARTICIPATION_FETCH_URL}/${promo_id}?status=all&order=created_desc`,
        { headers: { Authorization: `Bearer ${env.EASY_PROMO_API_KEY}` } }
      );
      return response.data?.items || [];
    } catch (error) {
      console.error(`Error fetching unique participants for promo ${promo_id}:`, error);
      return [];
    }
  }

  async getStats(promo_id?: string): Promise<DashboardStats> {
    const promotions = await this.fetchPromotions();
    let selectedPromoId = promo_id || promotions[0]?.id?.toString();

    if (!selectedPromoId) {
      throw new Error("No promotions available to fetch participants.");
    }

    const participants = await this.fetchParticipants(selectedPromoId);
    const uniqueParticipants = await this.fetchUniqueParticipants(selectedPromoId);

    const stats: DashboardStats = {
      totalParticipations: participants.length,
      uniqueParticipants: uniqueParticipants.length,
      prizesWon: 0,
      remainingPrizes: 0,
      participantsByStatus: { tourist: 0, resident: 0 },
      participantsByPrize: {},
      participantsByCountry: {},
      participantsByDevice: { mobile: 0, desktop: 0, tablet: 0, other: 0 },
      participationTrend: [],
      dayOfWeekTrend: [],
      hourOfDayTrend: [],
      prizes: [],
      conversionRate: 0,
      recentActivity: [],
    };

    const dailyCounts: { [date: string]: number } = {};
    const dayOfWeekCounts: { [day: string]: number } = {
      Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0,
    };
    // Changed: Store hour counts per date
    const hourCountsByDate: { [dateHour: string]: { date: string; hour: number; count: number } } = {};

    // Process participants
    participants.forEach((p) => {
      const status = p.user?.custom_properties?.find((prop: any) => prop.title === "Status")?.value?.toLowerCase();
      if (status === "tourist") stats.participantsByStatus.tourist++;
      if (status === "resident") stats.participantsByStatus.resident++;

      const prizeName = p.prize?.prize_type?.name;
      if (prizeName) {
        stats.prizesWon++;
        stats.participantsByPrize[prizeName] = (stats.participantsByPrize[prizeName] || 0) + 1;
      }

      const country = p.user?.country;
      if (country) stats.participantsByCountry[country] = (stats.participantsByCountry[country] || 0) + 1;

      const device = this.detectDevice(p.user_agent);
      stats.participantsByDevice[device]++;

      const createdAt = new Date(p.created);
      const dateKey = createdAt.toISOString().split("T")[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;

      const dayName = createdAt.toLocaleDateString("en-US", { weekday: "long" });
      dayOfWeekCounts[dayName]++;

      // Changed: Store hour counts with date
      const hour = createdAt.getHours();
      const dateHourKey = `${dateKey}_${hour}`;
      if (!hourCountsByDate[dateHourKey]) {
        hourCountsByDate[dateHourKey] = { date: dateKey, hour, count: 0 };
      }
      hourCountsByDate[dateHourKey].count++;

      if (stats.recentActivity.length < 10) {
        stats.recentActivity.push({
          time: createdAt.toISOString(),
          action: "Participation",
          details: `${p.user?.nickname || "Anonymous"} from ${p.user?.country || "Unknown"}`,
        });
      }
    });

    // Participation Trend
    stats.participationTrend = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Day of Week Trend
    stats.dayOfWeekTrend = Object.entries(dayOfWeekCounts).map(([day, count]) => ({ day, count }));

    // Hour of Day Trend (with date)
    stats.hourOfDayTrend = Object.values(hourCountsByDate)
      .sort((a, b) => {
        if (a.date === b.date) return a.hour - b.hour;
        return a.date.localeCompare(b.date);
      });

    // Prizes
    const prizeTypes = new Map();
    participants.forEach((p) => {
      if (p.prize?.prize_type) {
        const { name, qty } = p.prize.prize_type;
        const entry = prizeTypes.get(name) || { total: parseInt(qty), given: 0 };
        entry.given++;
        prizeTypes.set(name, entry);
      }
    });

    stats.prizes = Array.from(prizeTypes.entries()).map(([name, data]: [string, any]) => ({
      name,
      total: data.total,
      given: data.given,
      remaining: data.total - data.given,
    }));

    stats.remainingPrizes = stats.prizes.reduce((sum, p) => sum + p.remaining, 0);
    stats.conversionRate = participants.length
      ? (stats.prizesWon / participants.length) * 100
      : 0;

    return stats;
  }
}

export const dashboardService = new DashboardService();