const React = require("react");
const { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } = require("remotion");

function Headline({ text, theme = "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fontSize = text.length > 140 ? 56 : 72;
  const MAX_HEADLINE_LINES = 3;
  const lines = splitIntoLines(text, text.length > 140 ? 26 : 22, MAX_HEADLINE_LINES);
  const color = theme === "dark" ? "#ffffff" : "#101010";
  const gradient =
    theme === "dark"
      ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0) 100%)"
      : "linear-gradient(to top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 100%)";

  return React.createElement(
    AbsoluteFill,
    { style: { justifyContent: "flex-end" } },
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          padding: "260px 64px 120px 64px",
          background: gradient,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        },
      },
      lines.map((line, i) => {
        const delay = i * 4;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 200, stiffness: 120, mass: 0.6 },
        });
        const translateY = (1 - progress) * 30;
        return React.createElement(
          "div",
          {
            key: i,
            style: {
              fontFamily: "Inter, Arial, sans-serif",
              fontWeight: 800,
              fontSize,
              lineHeight: 1.15,
              color,
              opacity: progress,
              transform: `translateY(${translateY}px)`,
              textShadow: theme === "dark" ? "0 2px 12px rgba(0,0,0,0.5)" : "none",
            },
          },
          line
        );
      })
    )
  );
}

function splitIntoLines(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  // Só `maxLines` linhas aparecem na tela — o resto fica oculto. A
  // narração (áudio) não depende disso: ela sempre lê o texto completo,
  // separadamente (ver src/render.js).
  const visible = lines.slice(0, maxLines);
  const lastIdx = maxLines - 1;
  let lastLine = visible[lastIdx];
  const maxLastLineChars = Math.max(1, maxChars - 1); // espaço pra reticência
  if (lastLine.length > maxLastLineChars) {
    lastLine = lastLine.slice(0, maxLastLineChars).trimEnd();
  }
  visible[lastIdx] = lastLine + "…";
  return visible;
}

module.exports = { Headline };
