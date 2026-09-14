const React = require("react");
const {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} = require("remotion");
const { KenBurnsImage } = require("./components/KenBurnsImage");
const { Headline } = require("./components/Headline");
const { SourceBadge } = require("./components/SourceBadge");
const { NewsIntro } = require("./components/NewsIntro");

function Reel({
  headline,
  sourceName,
  imageSrc,
  audioSrc,
  musicSrc,
  introText,
  showIntro,
  fitMode,
  theme,
  introDurationInFrames,
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const introFrames = showIntro ? introDurationInFrames : 0;
  const mainFrames = durationInFrames - introFrames;

  const fadeOutOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: "#000" } },

    // --- abertura ---
    showIntro &&
      React.createElement(
        Sequence,
        { from: 0, durationInFrames: introFrames, layout: "none" },
        React.createElement(NewsIntro, { text: introText, durationInFrames: introFrames })
      ),

    // --- conteúdo principal ---
    React.createElement(
      Sequence,
      { from: introFrames, durationInFrames: mainFrames, layout: "none" },
      React.createElement(KenBurnsImage, { src: imageSrc, fitMode }),
      React.createElement(SourceBadge, { name: sourceName, theme }),
      React.createElement(Headline, { text: headline, theme })
    ),

    // --- narração: só entra depois que a abertura passar ---
    audioSrc &&
      React.createElement(
        Sequence,
        { from: introFrames, layout: "none" },
        React.createElement(Audio, { src: audioSrc, volume: 1.0 })
      ),

    // --- música de fundo: toca o vídeo inteiro, com fade-out junto do vídeo ---
    musicSrc &&
      React.createElement(Audio, {
        src: musicSrc,
        volume: (f) => {
          const base = audioSrc ? 0.15 : 0.35;
          const fade = interpolate(f, [durationInFrames - 20, durationInFrames], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return base * fade;
        },
      }),

    // --- fade final para preto ---
    React.createElement(AbsoluteFill, {
      style: { backgroundColor: "#000", opacity: fadeOutOpacity },
    })
  );
}

module.exports = { Reel };
