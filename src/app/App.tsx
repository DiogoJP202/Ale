import React, { useState } from "react";
import { GameMenu } from "./components/GameMenu";
import { GameScene } from "./components/GameScene";

type Screen = "menu" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [bgmVolume, setBgmVolume] = useState(0.4);

  return (
    <div className="size-full">
      {screen === "menu" ? (
        <GameMenu
          onStart={() => setScreen("game")}
          volume={bgmVolume}
          onChangeVolume={setBgmVolume}
        />
      ) : (
        <GameScene
          onBackToMenu={() => setScreen("menu")}
          volume={bgmVolume}
        />
      )}
    </div>
  );
}
