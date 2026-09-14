const React = require("react");
const { useCurrentFrame, interpolate } = require("remotion");

function SourceBadge({ name, theme = "dark" }) {
  const frame = useCurrentFrame();
  if (!name) return null;

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bg = theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
  const color = theme === "dark" ? "#ffffff" : "#101010";

  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        top: 64,
        left: 48,
        padding: "14px 28px",
        borderRadius: 999,
        backdropFilter: "blur(6px)",
        background: bg,
        color,
        fontFamily: "Inter, Arial, sans-serif",
        fontWeight: 700,
        fontSize: 32,
        opacity,
      },
    },
    name
  );
}

module.exports = { SourceBadge };
