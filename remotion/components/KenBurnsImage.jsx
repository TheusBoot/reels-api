const React = require("react");
const { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } = require("remotion");

/**
 * Fundo com efeito Ken Burns. Dois modos:
 * - "cover": preenche o quadro todo, cortando o que sobrar (como antes).
 * - "contain": mostra a imagem inteira sem cortar, com um fundo desfocado
 *   (a própria imagem, escalada e borrada) preenchendo as bordas.
 */
function KenBurnsImage({ src, fitMode }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();

  const zoomT = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (fitMode === "cover") {
    const scale = 1.0 + 0.12 * zoomT;
    const translateX = -20 * zoomT;
    const translateY = -10 * zoomT;
    return React.createElement(
      AbsoluteFill,
      { style: { overflow: "hidden", backgroundColor: "#000" } },
      React.createElement(Img, {
        src,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        },
      })
    );
  }

  // modo "contain": fundo desfocado (blur real via CSS filter — aqui é
  // seguro, pois o Remotion renderiza cada frame como uma imagem estática
  // via Chromium headless, sem o problema de captureStream+filter que existe
  // no MediaRecorder do navegador.
  const bgScale = 1.25 + 0.12 * zoomT;
  const fgScale = 1.0 + 0.05 * zoomT;

  return React.createElement(
    AbsoluteFill,
    { style: { overflow: "hidden", backgroundColor: "#000" } },
    // fundo borrado
    React.createElement(Img, {
      src,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: "blur(40px) brightness(0.55)",
        transform: `scale(${bgScale})`,
      },
    }),
    // imagem inteira, contida, sem cortar
    React.createElement(
      AbsoluteFill,
      { style: { display: "flex", alignItems: "center", justifyContent: "center" } },
      React.createElement(Img, {
        src,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${fgScale})`,
        },
      })
    )
  );
}

module.exports = { KenBurnsImage };
