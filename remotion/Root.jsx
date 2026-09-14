const React = require("react");
const { Composition } = require("remotion");
const { Reel } = require("./Reel");

const defaultProps = {
  headline: "Manchete de exemplo para pré-visualização",
  sourceName: "",
  imageSrc: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1080",
  audioSrc: null,
  musicSrc: null,
  introText: "OLHA SÓ O QUE ESTÁ BOMBANDO",
  showIntro: true,
  fitMode: "contain",
  durationInFrames: 450,
  introDurationInFrames: 36,
  theme: "dark",
};

function RemotionRoot() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
      id: "Reel",
      component: Reel,
      durationInFrames: defaultProps.durationInFrames,
      fps: 30,
      width: 1080,
      height: 1920,
      defaultProps,
    })
  );
}

module.exports = { RemotionRoot };
