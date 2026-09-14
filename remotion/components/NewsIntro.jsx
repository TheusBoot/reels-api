const React = require("react");
const { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } = require("remotion");

/**
 * Abertura estilo "chamada de telejornal/fofoca": selo URGENTE pulsando,
 * frase de impacto entrando, flash branco cortando pro vídeo principal.
 * Dura `durationInFrames` (tipicamente 36 frames = 1.2s a 30fps).
 */
function NewsIntro({ text, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  const badgeOpacity = interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const badgeScale = 0.85 + 0.15 * Math.min(badgeSpring, 1);

  const phraseDelayFrames = 4; // ~120ms a 30fps
  const lines = splitIntoLines(text, 20);
  const lineHeight = 78;
  const blockHeight = lines.length * lineHeight;
  const startY = H / 2 - blockHeight / 2 + lineHeight * 0.7;

  const flashStartFrame = durationInFrames - 7; // ~220ms antes do fim
  const flashOpacity = interpolate(frame, [flashStartFrame, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: "#0a0a0a" } },

    // brilho vermelho de fundo
    React.createElement(AbsoluteFill, {
      style: {
        background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 25%, rgba(180,10,30,0.35) 100%)",
      },
    }),

    // selo URGENTE
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 420,
          left: "50%",
          transform: `translateX(-50%) scale(${badgeScale})`,
          opacity: badgeOpacity,
          background: "#e0263d",
          borderRadius: 14,
          padding: "18px 40px",
        },
      },
      React.createElement(
        "span",
        {
          style: {
            color: "#fff",
            fontFamily: "Inter, Arial, sans-serif",
            fontWeight: 800,
            fontSize: 40,
          },
        },
        "URGENTE"
      )
    ),

    // frase principal, linha a linha
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: startY,
          left: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
      },
      lines.map((line, i) => {
        const localFrame = frame - phraseDelayFrames - i * 1.5;
        const progress = spring({ frame: localFrame, fps, config: { damping: 200, stiffness: 150, mass: 0.5 } });
        const translateY = (1 - Math.min(Math.max(progress, 0), 1)) * 24;
        return React.createElement(
          "div",
          {
            key: i,
            style: {
              fontFamily: "Inter, Arial, sans-serif",
              fontWeight: 800,
              fontSize: 66,
              lineHeight: `${lineHeight}px`,
              color: "#ffffff",
              opacity: Math.min(Math.max(progress, 0), 1),
              transform: `translateY(${translateY}px)`,
              textShadow: "0 0 18px rgba(224,38,61,0.7)",
              textAlign: "center",
            },
          },
          line
        );
      })
    ),

    // flash final
    React.createElement(AbsoluteFill, { style: { backgroundColor: "#fff", opacity: flashOpacity } })
  );
}

function splitIntoLines(text, maxChars) {
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
  return lines.slice(0, 4);
}

module.exports = { NewsIntro };
