// Calendar constants and configuration

export const PRIMARY_BG = "#f9fafb";
export const PRIMARY_DARK = "#1f2937";
export const PRIMARY_LIGHT = "#ffffff";
export const BORDER_COLOR = "#e5e7eb";
export const TIME_START = 0; // midnight
export const TIME_END = 24; // 24 hours
export const TIME_INTERVAL = 1; // 1 hour

export const VIEW_OPTIONS = ["Day", "Week", "Month"];

export const PASTEL_COLORS = {
  red: "#fee2e2",
  blue: "#dbeafe",
  yellow: "#fef3c7",
  orange: "#fed7aa",
  green: "#dcfce7",
  purple: "#e9d5ff",
};

// CSS animation keyframes
export const CALENDAR_STYLES = `
  @keyframes liquify {
    0%, 100% {
      border-radius: 50px;
      box-shadow: 0 8px 32px rgba(236, 72, 153, 0.25), 0 0 60px rgba(168, 85, 247, 0.15), inset 0 2px 10px rgba(255,255,255,0.8);
    }
    25% {
      border-radius: 45px 55px 50px 48px;
      box-shadow: 0 10px 35px rgba(168, 85, 247, 0.3), 0 0 70px rgba(236, 72, 153, 0.2), inset 0 2px 12px rgba(255,255,255,0.9);
    }
    50% {
      border-radius: 52px 48px 53px 47px;
      box-shadow: 0 12px 38px rgba(59, 130, 246, 0.25), 0 0 65px rgba(16, 185, 129, 0.18), inset 0 3px 15px rgba(255,255,255,0.85);
    }
    75% {
      border-radius: 48px 52px 46px 54px;
      box-shadow: 0 9px 30px rgba(16, 185, 129, 0.22), 0 0 68px rgba(59, 130, 246, 0.2), inset 0 2px 11px rgba(255,255,255,0.9);
    }
  }

  @keyframes liquify-day {
    0%, 100% {
      border-radius: 24px;
      box-shadow: 0 8px 24px rgba(236, 72, 153, 0.2), 0 0 40px rgba(168, 85, 247, 0.1), inset 0 1px 8px rgba(255,255,255,0.6);
    }
    25% {
      border-radius: 20px 28px 24px 22px;
      box-shadow: 0 10px 28px rgba(168, 85, 247, 0.25), 0 0 50px rgba(236, 72, 153, 0.15), inset 0 1px 10px rgba(255,255,255,0.7);
    }
    50% {
      border-radius: 26px 22px 25px 21px;
      box-shadow: 0 12px 32px rgba(59, 130, 246, 0.2), 0 0 45px rgba(16, 185, 129, 0.12), inset 0 2px 12px rgba(255,255,255,0.65);
    }
    75% {
      border-radius: 22px 26px 20px 28px;
      box-shadow: 0 9px 26px rgba(16, 185, 129, 0.18), 0 0 48px rgba(59, 130, 246, 0.15), inset 0 1px 9px rgba(255,255,255,0.7);
    }
  }

  @keyframes liquify-week {
    0%, 100% {
      border-radius: 32px;
    }
    25% {
      border-radius: 28px 36px 32px 30px;
    }
    50% {
      border-radius: 34px 30px 33px 29px;
    }
    75% {
      border-radius: 30px 34px 28px 36px;
    }
  }
`;
