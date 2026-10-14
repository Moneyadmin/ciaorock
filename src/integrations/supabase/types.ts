export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          title: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          title: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      double_days: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          multiplier: number;
        };
        Insert: {
          created_at?: string;
          day: string;
          id?: string;
          multiplier?: number;
        };
        Update: {
          created_at?: string;
          day?: string;
          id?: string;
          multiplier?: number;
        };
        Relationships: [];
      };
      finds: {
        Row: {
          city: string | null;
          continent: string | null;
          country: string | null;
          found_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          photo: string;
          points_awarded: number;
          region: string | null;
          rock_id: string;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          continent?: string | null;
          country?: string | null;
          found_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          photo: string;
          points_awarded?: number;
          region?: string | null;
          rock_id: string;
          user_id?: string;
        };
        Update: {
          city?: string | null;
          continent?: string | null;
          country?: string | null;
          found_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          photo?: string;
          points_awarded?: number;
          region?: string | null;
          rock_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finds_rock_id_fkey";
            columns: ["rock_id"];
            isOneToOne: false;
            referencedRelation: "rocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finds_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: {
          created_at: string;
          friend_id: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          friend_id: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          friend_id?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          recipient_id: string;
          sender_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          recipient_id: string;
          sender_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          recipient_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_locations: {
        Row: {
          lat: number;
          lng: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          lat: number;
          lng: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          lat?: number;
          lng?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          banned: boolean;
          bio: string;
          created_at: string;
          id: string;
          last_login_date: string | null;
          latitude: number | null;
          longitude: number | null;
          nickname: string;
          points_adjust: number;
          streak_best: number;
          streak_current: number;
          updated_at: string | null;
        };
        Insert: {
          banned?: boolean;
          bio?: string;
          created_at?: string;
          id: string;
          last_login_date?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          nickname: string;
          points_adjust?: number;
          streak_best?: number;
          streak_current?: number;
          updated_at?: string | null;
        };
        Update: {
          banned?: boolean;
          bio?: string;
          created_at?: string;
          id?: string;
          last_login_date?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          nickname?: string;
          points_adjust?: number;
          streak_best?: number;
          streak_current?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      rock_ratings: {
        Row: {
          created_at: string;
          feedback: string | null;
          rock_id: string;
          sentiment: number | null;
          stars: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          feedback?: string | null;
          rock_id: string;
          sentiment?: number | null;
          stars: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feedback?: string | null;
          rock_id?: string;
          sentiment?: number | null;
          stars?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rock_ratings_rock_id_fkey";
            columns: ["rock_id"];
            isOneToOne: false;
            referencedRelation: "rocks";
            referencedColumns: ["id"];
          },
        ];
      };
      rocks: {
        Row: {
          ai_points: number | null;
          ai_reason: string | null;
          clue: string;
          created_at: string;
          creator_id: string;
          deleted_at: string | null;
          difficulty: string;
          hidden_by: string | null;
          id: string;
          lat: number;
          lng: number;
          move_count: number;
          name: string;
          photo: string;
          points: number;
          points_override: number | null;
          rating_avg: number | null;
          rating_count: number;
          sentiment_avg: number | null;
          updated_at: string;
        };
        Insert: {
          ai_points?: number | null;
          ai_reason?: string | null;
          clue: string;
          created_at?: string;
          creator_id?: string;
          deleted_at?: string | null;
          difficulty?: string;
          hidden_by?: string | null;
          id?: string;
          lat: number;
          lng: number;
          move_count?: number;
          name: string;
          photo: string;
          points?: number;
          points_override?: number | null;
          rating_avg?: number | null;
          rating_count?: number;
          sentiment_avg?: number | null;
          updated_at?: string;
        };
        Update: {
          ai_points?: number | null;
          ai_reason?: string | null;
          clue?: string;
          created_at?: string;
          creator_id?: string;
          deleted_at?: string | null;
          difficulty?: string;
          hidden_by?: string | null;
          id?: string;
          lat?: number;
          lng?: number;
          move_count?: number;
          name?: string;
          photo?: string;
          points?: number;
          points_override?: number | null;
          rating_avg?: number | null;
          rating_count?: number;
          sentiment_avg?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rocks_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rocks_hidden_by_fkey";
            columns: ["hidden_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean };
      tier_from_avg: { Args: { _avg: number }; Returns: string };
      touch_streak: {
        Args: never;
        Returns: { last_login_date: string | null; streak_best: number; streak_current: number }[];
      };
      tier_points: { Args: { _tier: string }; Returns: number };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
