// ===== 사이트 테마 (라이트/다크 모드 + 사용자 컬러) =====
// 로그인한 사용자의 user metadata에 저장된 설정으로 사이트 전체 색을 정한다.
//   - theme_mode       : "light"(기본) 또는 "dark"
//   - use_custom_color : false면 기본 남색, 그 외(없음 포함)면 favorite_color 사용
//   - favorite_color   : 가입 때 고른 색 "#rrggbb"
// 로그인 전이거나 설정이 없으면 style.css의 기본값(라이트 모드 + 남색)이 쓰인다.
//
// <head>에서 Supabase 설정(SUPABASE_URL) 다음, 본문보다 먼저 불러와야
// 화면이 기본색으로 그려졌다가 바뀌는 깜빡임이 없다.
// 그래서 비동기인 getSession() 대신, supabase-js가 브라우저에 저장해 둔
// 로그인 정보를 바로 읽는다.
//
// 다른 스크립트에서는 window.SiteTheme.apply(user_metadata)로 즉시 다시 적용할 수 있다.
(function () {
  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];
  const DARK_SURFACE = [27, 30, 41]; // style.css 다크 모드의 --color-surface (#1b1e29)
  const DARK_TEXT = "#12141c";

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  }

  // a와 b를 t 비율로 섞는다 (t=0이면 a, t=1이면 b)
  function mix(a, b, t) {
    return a.map((v, i) => v * (1 - t) + b[i] * t);
  }

  function luminance(rgb) {
    const [r, g, b] = rgb.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // 두 색의 명암비 (1 ~ 21)
  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  const CUSTOM_PROPS = [
    "--color-primary",
    "--color-primary-hover",
    "--color-primary-soft",
    "--color-primary-rgb",
    "--color-on-primary"
  ];

  function applyCustomColor(hex, isDark) {
    const bg = isDark ? DARK_SURFACE : WHITE;
    const toward = isDark ? WHITE : BLACK;

    // 배경과 너무 비슷한 색(라이트에서 노랑·흰색, 다크에서 남색·검정 등)은
    // 글씨가 안 보이므로 읽을 수 있을 만큼(명암비 3 이상) 조금씩 조정한다
    let primary = hexToRgb(hex);
    for (let i = 0; i < 20 && contrast(primary, bg) < 3; i++) {
      primary = mix(primary, toward, 0.1);
    }

    // 버튼 위 글씨는 흰색/검정 중 더 잘 보이는 쪽
    const onPrimary =
      contrast(primary, WHITE) >= contrast(primary, hexToRgb(DARK_TEXT)) ? "#ffffff" : DARK_TEXT;

    const root = document.documentElement.style;
    root.setProperty("--color-primary", rgbToHex(primary));
    root.setProperty("--color-primary-hover", rgbToHex(mix(primary, toward, 0.2)));
    root.setProperty("--color-primary-soft", rgbToHex(isDark ? mix(primary, DARK_SURFACE, 0.82) : mix(primary, WHITE, 0.92)));
    root.setProperty("--color-primary-rgb", primary.map(Math.round).join(", "));
    root.setProperty("--color-on-primary", onPrimary);
  }

  function apply(meta) {
    meta = meta || {};
    const isDark = meta.theme_mode === "dark";
    const html = document.documentElement;

    // 라이트/다크 모드: 다크면 <html data-theme="dark">
    if (isDark) {
      html.setAttribute("data-theme", "dark");
    } else {
      html.removeAttribute("data-theme");
    }

    // 먼저 사용자 색을 지워 style.css의 기본색으로 되돌린 뒤, 필요하면 다시 덮어쓴다
    CUSTOM_PROPS.forEach((p) => html.style.removeProperty(p));

    const color = meta.favorite_color;
    const useCustom = meta.use_custom_color !== false;
    if (useCustom && typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
      applyCustomColor(color, isDark);
    }
  }

  window.SiteTheme = { apply };

  try {
    // supabase-js v2는 로그인 정보를 "sb-<프로젝트ID>-auth-token" 키에 저장한다
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    const raw = localStorage.getItem("sb-" + projectRef + "-auth-token");
    if (!raw) return; // 로그인 전: 기본 테마

    const user = JSON.parse(raw).user;
    apply(user && user.user_metadata);
  } catch (e) {
    // 저장소를 읽을 수 없으면 기본 테마 그대로 둔다
  }
})();
