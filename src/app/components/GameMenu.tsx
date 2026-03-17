import React, { useState, useEffect, useMemo, useRef } from "react";
import "../styles/game-menu.css";

interface Props {
  onStart: () => void;
  volume: number;
  onChangeVolume: (value: number) => void;
  mobileControls: boolean;
  onMobileControlsChange: (enabled: boolean) => void;
}

export function GameMenu({ onStart, volume, onChangeVolume, mobileControls, onMobileControlsChange }: Props) {
  const [showButton, setShowButton] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  // No mobile: ao entrar no menu, rolar para baixo para mostrar título, botão e controlos
  useEffect(() => {
    const scrollToBottom = () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    };
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(t);
  }, []);

  // Título faz fade-in; depois de ~2.5s o botão Iniciar aparece
  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Música de fundo no menu inicial
  useEffect(() => {
    if (!bgmRef.current) {
      const audio = new Audio("/Musicas/Twenty One Pilots - Oldies Station (8-bit).mp3");
      audio.loop = true;
      audio.volume = volume;
      bgmRef.current = audio;
      audio.play().catch(() => {});
    }
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
    };
  }, []);

  // Atualizar volume quando o slider mudar
  useEffect(() => {
    if (bgmRef.current) {
      bgmRef.current.volume = volume;
    }
  }, [volume]);

  const handleStart = () => { onStart(); };

  // Gerar estrelas aleatórias (memo para evitar re-geração)
  const stars = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 60,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 2,
  })), []);

  // Gerar flores dama-da-noite
  const flowers = useMemo(() => Array.from({ length: 25 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    bottom: Math.random() * 40,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
  })), []);

  // Gerar partículas flutuantes
  const particles = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 8 + Math.random() * 4,
  })), []);

  return (
    <div className="game-menu">
      {/* Céu noturno */}
      <div className="sky">
        {/* Estrelas */}
        {stars.map((star) => (
          <div
            key={star.id}
            className="star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}

        {/* Lua */}
        <div className="moon">
          <div className="moon-glow" />
        </div>
      </div>

      {/* Campo de flores */}
      <div className="field">
        {/* Partículas flutuantes */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="particle"
            style={{
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}

        {/* Flores dama-da-noite */}
        {flowers.map((flower) => (
          <div
            key={flower.id}
            className="flower"
            style={{
              left: `${flower.left}%`,
              bottom: `${flower.bottom}%`,
              animationDelay: `${flower.delay}s`,
              animationDuration: `${flower.duration}s`,
            }}
          >
            <div className="flower-petals" />
            <div className="flower-stem" />
          </div>
        ))}
      </div>

      {/* Título do jogo: fade-in + flutuação suave */}
      <div className="menu-title-wrap">
        <img
          src="/TítuloPrincipal.png"
          alt="Doces Memórias da Ale"
          className="menu-title-image"
        />
      </div>

      {/* Opção de botões no celular — canto inferior esquerdo */}
      <div className="menu-controls-bottom-left">
        <label className="menu-switch-label">
          <input
            type="checkbox"
            className="menu-switch-input"
            checked={mobileControls}
            onChange={(e) => onMobileControlsChange(e.target.checked)}
          />
          <span className="menu-switch-track" aria-hidden />
          <span className="menu-switch-text">Usar botões na tela (celular)</span>
        </label>
      </div>

      {/* Volume — canto inferior direito */}
      <div className="menu-controls-bottom-right">
        <div className="menu-volume-box">
          <span className="menu-volume-label">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="menu-volume-slider"
          />
        </div>
      </div>

      {/* Botão de início */}
      <button
        className={`start-button ${showButton ? "visible" : ""}`}
        onClick={handleStart}
      >
        Iniciar
      </button>
    </div>
  );
}