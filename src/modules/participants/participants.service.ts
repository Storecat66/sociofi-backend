import axios, { AxiosResponse } from "axios";
import { sanitizeParticipants } from "./participants.model";
import env from "../../config/env";

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
  prize?: {
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
  sort?: "created_asc" | "created_desc";
  country?: string;
  dateFrom?: string; // ✅ date range start (YYYY-MM-DD)
  dateTo?: string; // ✅ date range end (YYYY-MM-DD)
  status?: "active" | "inactive";
}

export interface GetParticipantsResult {
  participants: Participant[];
  hasNext: boolean;
  total: number;
  page: number;
  totalPages: number;
}

export class ParticipantsService {
  /**
   * Get participants from EasyPromos API with pagination and filtering
   */
  async getParticipants(
    options: GetParticipantsOptions = {},
    promo_id?: string
  ): Promise<GetParticipantsResult> {
    const {
      limit = 30,
      offset = 0,
      search,
      sort = "created_desc",
      country,
      dateFrom,
      dateTo,
      status,
    } = options;

    try {
      // ✅ Fetch all participants (EasyPromos doesn't support filtering, so get all)
      const response: AxiosResponse<any> = await axios.get(
        `${env.EASY_PROMO_PARTICIPATION_FETCH_URL}/${promo_id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${env.EASY_PROMO_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      // ✅ Validate response
      if (!response.data || !Array.isArray(response.data.items)) {
        console.error("Invalid API response structure:", response.data);
        throw new Error("Invalid response format from EasyPromos API");
      }

      const allItems = response.data.items.filter(
        (item: any) => item && typeof item === "object"
      );

      console.log(`Fetched ${allItems.length} participants from EasyPromos API`);
      
      if (dateFrom || dateTo) {
        console.log(`Applying date range filter: ${dateFrom || 'no start'} to ${dateTo || 'no end'}`);
      }

      // ✅ Step 1: Filter by country, date, and status
      let filteredItems = allItems.filter((item: any) => {
        let keep = true;

        // 🔹 Filter by country (case-insensitive)
        if (country && country.trim()) {
          const itemCountry = item.user?.country?.toLowerCase()?.trim();
          const filterCountry = country.toLowerCase().trim();
          if (!itemCountry || itemCountry !== filterCountry) {
            keep = false;
          }
        }

        // 🔹 Filter by date range (dateFrom to dateTo)
        if (dateFrom || dateTo) {
          try {
            const itemDate = new Date(item.created);
            
            if (dateFrom) {
              const fromDate = new Date(dateFrom);
              fromDate.setHours(0, 0, 0, 0); // Start of the day
              if (itemDate < fromDate) {
                keep = false;
              }
            }
            
            if (dateTo) {
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999); // End of the day
              if (itemDate > toDate) {
                keep = false;
              }
            }
          } catch (error) {
            console.warn("Invalid date filtering:", item.created, dateFrom, dateTo);
            keep = false;
          }
        }

        // 🔹 Filter by user status
        if (status) {
          const isActive = item.user?.status === "1";
          if (status === "active" && !isActive) keep = false;
          if (status === "inactive" && isActive) keep = false;
        }

        return keep;
      });

      console.log(`After filtering: ${filteredItems.length} participants`);

      // ✅ Step 2: Local search (name, email, phone, order)
      if (search && search.trim().length > 0) {
        const query = search.trim().toLowerCase();
        filteredItems = filteredItems.filter((p: any) => {
          const user = p.user || {};
          const orderValue =
            p.requirement?.data?.[0]?.value?.toLowerCase?.() || "";
          
          const searchableFields = [
            user.email?.toLowerCase(),
            user.nickname?.toLowerCase(), 
            user.first_name?.toLowerCase(),
            user.last_name?.toLowerCase(),
            user.phone?.toLowerCase(),
            orderValue,
            p.id?.toLowerCase(),
            user.id?.toLowerCase()
          ].filter(Boolean); // Remove null/undefined values

          return searchableFields.some(field => 
            field && field.includes(query)
          );
        });
      }

      console.log(`After search filtering: ${filteredItems.length} participants`);

      // ✅ Step 3: Manual sort (by created date)
      filteredItems.sort((a: any, b: any) => {
        try {
          const dateA = new Date(a.created).getTime();
          const dateB = new Date(b.created).getTime();
          
          // Handle invalid dates
          if (isNaN(dateA) && isNaN(dateB)) return 0;
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          
          return sort === "created_asc" ? dateA - dateB : dateB - dateA;
        } catch (error) {
          console.warn("Error sorting participants:", error);
          return 0;
        }
      });

      // ✅ Step 4: Manual pagination
      const total = filteredItems.length;
      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);
      const hasNext = offset + limit < total;

      const paginatedItems = filteredItems.slice(offset, offset + limit);

      console.log(`Pagination: page ${page}/${totalPages}, showing ${paginatedItems.length}/${total} participants`);

      // ✅ Step 5: Return sanitized data
      return {
        participants: sanitizeParticipants(paginatedItems),
        hasNext,
        total,
        page,
        totalPages,
      };
    } catch (error: any) {
      console.error("Error fetching participants from EasyPromos API:", error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401)
          throw new Error("Invalid API key or unauthorized access");
        if (status === 404) throw new Error("Promotion not found");
        if (status === 429) throw new Error("Rate limit exceeded");
      }

      throw new Error("Failed to fetch participants data");
    }
  }

  /**
   * Get participant by ID
   */
  async getParticipantById(
    participantId: string, 
    promo_id?: string
  ): Promise<Participant | null> {
    try {
      const result = await this.getParticipants({ limit: 1000 }, promo_id);
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
    options: Omit<GetParticipantsOptions, "search"> = {},
    promo_id?: string
  ): Promise<GetParticipantsResult> {
    return this.getParticipants({
      ...options,
      search: query,
    }, promo_id);
  }

  /**
   * Get participants statistics
   */
  async getParticipantsStats(promo_id?: string): Promise<{
    totalParticipants: number;
    totalCountries: number;
    topCountries: Array<{ country: string; count: number }>;
    recentParticipations: number;
  }> {
    try {
      // Get a large sample to calculate stats
      const result = await this.getParticipants({ limit: 1000 }, promo_id);
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
  async getCountries(promo_id?: string): Promise<string[]> {
    try {
      const result = await this.getParticipants({ limit: 1000 }, promo_id);
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
