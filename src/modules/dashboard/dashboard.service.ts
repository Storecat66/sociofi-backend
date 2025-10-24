import axios from "axios";
import env from "../../config/env";

export interface DashboardStats {
  totalParticipants: number;
  participantsByStatus: {
    tourist: number;
    resident: number;
  };
  participantsByPrize: {
    [key: string]: number;
  };
  participantsByCountry: {
    [key: string]: number;
  };
  participantsByDevice: {
    mobile: number;
    desktop: number;
    tablet: number;
    other: number;
  };
  participationTrend: {
    date: string;
    count: number;
  }[];
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
  private detectDevice(
    userAgent: string
  ): "mobile" | "desktop" | "tablet" | "other" {
    const ua = userAgent?.toLowerCase?.() || "";
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      return "mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      return "tablet";
    } else if (
      ua.includes("windows") ||
      ua.includes("macintosh") ||
      ua.includes("linux")
    ) {
      return "desktop";
    }
    return "other";
  }

  private async fetchPromotions(): Promise<any[]> {
    try {
      const response = await axios.get(env.EASY_PROMO_PROMOTION_FETCH_URL, {
        headers: { Authorization: `Bearer ${env.EASY_PROMO_API_KEY}` },
      });

      // ✅ Return only the items array
      const promotions = response.data?.items || [];
      console.log(`Fetched ${promotions.length} promotions`);
      return promotions;
    } catch (error) {
      console.error("Error fetching promotions:", error);
      return [];
    }
  }

  private async fetchParticipants(
    promo_id: string,
    days: number = 30
  ): Promise<any[]> {
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    try {
      const response = await axios.get(
        `${env.EASY_PROMO_PARTICIPATION_FETCH_URL}/${promo_id}?format=full`,
        {
          headers: { Authorization: `Bearer ${env.EASY_PROMO_API_KEY}` },
        }
      );

      const items = response.data?.items || [];
      console.log(`Fetched ${items.length} participants for promo ${promo_id}`);
      return items;
    } catch (error) {
      console.error(
        `Error fetching participants for promo ${promo_id}:`,
        error
      );
      return [];
    }
  }

  async getStats(promo_id?: string): Promise<DashboardStats> {
    const promotions = await this.fetchPromotions();

    // ✅ If no promo_id provided, use the first available promotion
    let selectedPromoId = promo_id;
    if (!selectedPromoId && promotions.length > 0) {
      selectedPromoId = promotions[0].id?.toString();
      console.log(
        `No promo_id provided — defaulting to first promo: ${selectedPromoId}`
      );
    }

    console.log(`Using promo_id: ${selectedPromoId} to fetch participants.`);

    // 🟡 Handle no promotions gracefully
    if (!selectedPromoId) {
      throw new Error("No promotions available to fetch participants.");
    }

    const participants = await this.fetchParticipants(selectedPromoId);
    const now = new Date();

    const stats: DashboardStats = {
      totalParticipants: participants.length,
      participantsByStatus: { tourist: 0, resident: 0 },
      participantsByPrize: {},
      participantsByCountry: {},
      participantsByDevice: { mobile: 0, desktop: 0, tablet: 0, other: 0 },
      participationTrend: [],
      prizes: [],
      conversionRate: 0,
      recentActivity: [],
    };

    // Initialize daily counts for trend
    const dailyCounts: { [key: string]: number } = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dailyCounts[date.toISOString().split("T")[0]] = 0;
    }

    // Process participants
    participants.forEach((participant) => {
      // Status
      const status = participant.user?.custom_properties
        ?.find((prop: any) => prop.title === "Status")
        ?.value?.toLowerCase();
      if (status === "tourist") stats.participantsByStatus.tourist++;
      if (status === "resident") stats.participantsByStatus.resident++;

      // Prize
      const prizeName = participant.prize?.prize_type?.name;
      if (prizeName) {
        stats.participantsByPrize[prizeName] =
          (stats.participantsByPrize[prizeName] || 0) + 1;
      }

      // Country
      const country = participant.user?.country;
      if (country) {
        stats.participantsByCountry[country] =
          (stats.participantsByCountry[country] || 0) + 1;
      }

      // Device
      const device = this.detectDevice(participant.user_agent);
      stats.participantsByDevice[device]++;

      // Trend
      const date = new Date(participant.created).toISOString().split("T")[0];
      if (dailyCounts[date] !== undefined) dailyCounts[date]++;

      // Recent Activity (limit 10)
      if (stats.recentActivity.length < 10) {
        stats.recentActivity.push({
          time: new Date(participant.created).toISOString(),
          action: "Participation",
          details: `${participant.user?.nickname || "Anonymous"} from ${
            participant.user?.country || "Unknown"
          }`,
        });
      }
    });

    // Build trend
    stats.participationTrend = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Prizes
    const prizeTypes = new Map();
    participants.forEach((p) => {
      if (p.prize?.prize_type) {
        const { name, qty } = p.prize.prize_type;
        const entry = prizeTypes.get(name) || {
          total: parseInt(qty),
          given: 0,
        };
        entry.given++;
        prizeTypes.set(name, entry);
      }
    });

    stats.prizes = Array.from(prizeTypes.entries()).map(
      ([name, data]: [string, any]) => ({
        name,
        total: data.total,
        given: data.given,
        remaining: data.total - data.given,
      })
    );

    // Conversion rate
    const participantsWithPrizes = participants.filter((p) => p.prize).length;
    stats.conversionRate = participants.length
      ? (participantsWithPrizes / participants.length) * 100
      : 0;

    return stats;
  }
}

export const dashboardService = new DashboardService();
