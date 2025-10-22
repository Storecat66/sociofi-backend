import axios, { AxiosResponse } from "axios";
import { sanitizeParticipants } from "./participants.model";

// TypeScript interfaces for EasyPromos API response
export interface Participant {
  id: string;
  promotion_id: string;
  stage_id: string;
  user_id: string;
  created: string;
  ip: string;
  user_agent: string;
  points: string;
  completed: string | null;
  data: any[];
  requirement: {
    type: number;
    code: string | null;
    data: Array<{
      ref: string;
      title: string;
      value: string;
    }>;
  };
  user: {
    id: string;
    promotion_id: string;
    first_name: string;
    last_name: string | null;
    nickname: string;
    login_type: string;
    social_id: string | null;
    external_id: string;
    status: string;
    email: string;
    phone: string;
    birthday: string | null;
    created: string;
    avatar_img: string | null;
    language: string;
    country: string;
    custom_properties: Array<{
      id: string;
      value: string;
      title: string;
      ref: string;
    }>;
    meta_data: {
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      referral_url: string | null;
      ip: string;
      user_agent: string;
      legals: {
        terms_url: string;
        privacy_url: string | null;
        accepted_cookies: string | null;
      };
    };
  };
  prize: {
    id: string;
    prize_type: {
      id: string;
      name: string;
      ref: string;
      description: string;
      assignation_type: string;
      qty: string;
      given: string | null;
      image: string;
      instructions: string;
    };
    user_id: string;
    stage_id: string;
    participation_id: string;
    created: string;
    code: string;
    download_url: string;
    redeem_url: string;
  };
}

export interface EasyPromosApiResponse {
  items: Participant[];
  paging: {
    items_page: number;
  };
}

export interface GetParticipantsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  order?: "created_asc" | "created_desc";
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export interface GetParticipantsResult {
  participants: Participant[];
  hasNext: boolean;
  total: number;
  page: number;
  totalPages: number;
}

export class ParticipantsService {
  private readonly baseUrl =
    "https://api.easypromosapp.com/v2/participations/999707";
  private readonly apiKey = process.env.EASY_PROMO_API_KEY;

  constructor() {
    if (!this.apiKey) {
      throw new Error("EASY_PROMO_API_KEY is required");
    }
  }

  /**
   * Get participants from EasyPromos API with pagination and filtering
   */
  async getParticipants(
    options: GetParticipantsOptions = {}
  ): Promise<GetParticipantsResult> {
    const {
      limit = 30,
      offset = 0,
      search,
      order = "created_desc",
      country,
      dateFrom,
      dateTo,
      status,
    } = options;

    try {
      // EasyPromos API doesn't support limit/search, so fetch all and filter locally
      const response: AxiosResponse<EasyPromosApiResponse> = await axios.get(
        `${this.baseUrl}?format=full&order=${order}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const allItems = response.data.items;

      // ✅ Step 1: Filter by country, date, and status
      let filteredItems = allItems.filter((item) => {
        let keep = true;

        if (
          country &&
          item.user.country.toLowerCase() !== country.toLowerCase()
        )
          keep = false;

        if (dateFrom && new Date(item.created) < new Date(dateFrom))
          keep = false;
        if (dateTo && new Date(item.created) > new Date(dateTo)) keep = false;

        if (status) {
          const isActive = item.user.status === "1";
          if (status === "active" && !isActive) keep = false;
          if (status === "inactive" && isActive) keep = false;
        }

        return keep;
      });

      // ✅ Step 2: Local Search (by name, email, phone, or order number)
      if (search && search.trim().length > 0) {
        const query = search.trim().toLowerCase();
        filteredItems = filteredItems.filter((p) => {
          const user = p.user;
          const orderValue =
            p.requirement?.data?.[0]?.value?.toLowerCase?.() || "";

          return (
            user?.email?.toLowerCase().includes(query) ||
            user?.nickname?.toLowerCase().includes(query) ||
            user?.first_name?.toLowerCase().includes(query) ||
            user?.phone?.toLowerCase().includes(query) ||
            orderValue.includes(query)
          );
        });
      }

      // ✅ Step 3: Sort manually (EasyPromos order param doesn’t guarantee sort)
      filteredItems.sort((a, b) => {
        const dateA = new Date(a.created).getTime();
        const dateB = new Date(b.created).getTime();
        return order === "created_asc" ? dateA - dateB : dateB - dateA;
      });

      // ✅ Step 4: Manual pagination
      const total = filteredItems.length;
      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);
      const hasNext = offset + limit < total;

      const paginatedItems = filteredItems.slice(offset, offset + limit);

      // ✅ Step 5: Sanitize before returning
      return {
        participants: sanitizeParticipants(paginatedItems),
        hasNext,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      console.error("Error fetching participants from EasyPromos API:", error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401)
          throw new Error("Invalid API key or unauthorized access");
        if (axiosError.response?.status === 404)
          throw new Error("Promotion not found");
        if (axiosError.response?.status === 429)
          throw new Error("Rate limit exceeded");
      }

      throw new Error("Failed to fetch participants data");
    }
  }

  /**
   * Get participant by ID
   */
  async getParticipantById(participantId: string): Promise<Participant | null> {
    try {
      const result = await this.getParticipants({ limit: 100 });
      return result.participants.find((p) => p.id === participantId) || null;
    } catch (error) {
      console.error("Error fetching participant by ID:", error);
      throw new Error("Failed to fetch participant data");
    }
  }

  /**
   * Search participants by email, name, or phone
   */
  async searchParticipants(
    query: string,
    options: Omit<GetParticipantsOptions, "search"> = {}
  ): Promise<GetParticipantsResult> {
    return this.getParticipants({
      ...options,
      search: query,
    });
  }

  /**
   * Get participants statistics
   */
  async getParticipantsStats(): Promise<{
    totalParticipants: number;
    totalCountries: number;
    topCountries: Array<{ country: string; count: number }>;
    recentParticipations: number;
  }> {
    try {
      // Get a large sample to calculate stats
      const result = await this.getParticipants({ limit: 100 });
      const participants = result.participants;

      // Count countries
      const countryMap = new Map<string, number>();
      participants.forEach((p) => {
        const country = p.user.country || "Unknown";
        countryMap.set(country, (countryMap.get(country) || 0) + 1);
      });

      const topCountries = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent participations (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentParticipations = participants.filter(
        (p) => new Date(p.created) >= sevenDaysAgo
      ).length;

      return {
        totalParticipants: result.total,
        totalCountries: countryMap.size,
        topCountries,
        recentParticipations,
      };
    } catch (error) {
      console.error("Error fetching participants stats:", error);
      throw new Error("Failed to fetch participants statistics");
    }
  }

  /**
   * Get unique countries from participants
   */
  async getCountries(): Promise<string[]> {
    try {
      const result = await this.getParticipants({ limit: 100 });
      const countries = new Set(
        result.participants.map((p) => p.user.country).filter(Boolean)
      );
      return Array.from(countries).sort();
    } catch (error) {
      console.error("Error fetching countries:", error);
      throw new Error("Failed to fetch countries data");
    }
  }
}

export const participantsService = new ParticipantsService();
