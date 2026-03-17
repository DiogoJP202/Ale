import React, { useState, useEffect } from "react";
import { GameMenu } from "./components/GameMenu";
import { GameScene } from "./components/GameScene";

const STORAGE_MOBILE_CONTROLS = "campo-iluminado-mobile-controls";

type Screen = "menu" | "game";

function readMobileControls(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_MOBILE_CONTROLS);
    if (v === "0" || v === "false") return false;
    return true; /* default true quando não há valor guardado */
  } catch {
    return true;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [bgmVolume, setBgmVolume] = useState(0.4);
  const [mobileControls, setMobileControls] = useState(true);

  useEffect(() => {
    setMobileControls(readMobileControls());
  }, []);

  const handleMobileControlsChange = (enabled: boolean) => {
    setMobileControls(enabled);
    try {
      localStorage.setItem(STORAGE_MOBILE_CONTROLS, enabled ? "1" : "0");
    } catch {}
  };

  return (
    <div className="size-full">
      {screen === "menu" ? (
        <GameMenu
          onStart={() => setScreen("game")}
          volume={bgmVolume}
          onChangeVolume={setBgmVolume}
          mobileControls={mobileControls}
          onMobileControlsChange={handleMobileControlsChange}
        />
      ) : (
        <GameScene
          onBackToMenu={() => setScreen("menu")}
          volume={bgmVolume}
          mobileControls={mobileControls}
        />
      )}
    </div>
  );
}
