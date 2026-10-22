import React, { useState, useRef, useEffect } from 'react';
import { useYouth } from '../YouthContext';
import { Send, Radio, Sparkles, User, Users } from 'lucide-react';

export const YouthChat: React.FC = () => {
  const { currentYouthUser, chatMessages, sendChatMessage, currentYouthOperation } = useYouth();
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'jugend' | 'erwachsene' | 'leitung'>('all');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredMessages = chatMessages.filter(
    (m) => selectedChannel === 'all' || m.channel === 'all' || m.channel === selectedChannel
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(inputText, selectedChannel);
    setInputText('');
  };

  const handleQuickChip = (text: string) => {
    sendChatMessage(text, selectedChannel);
  };

  const isJoint = currentYouthOperation?.type === 'joint';

  return (
    <div className="w-full flex-1 flex flex-col bg-[#00083D] text-white overflow-hidden font-sans">
      {/* Channel Switcher */}
      <div className="p-3 bg-[#000E66] border-b border-blue-900 flex items-center gap-2 overflow-x-auto text-xs font-mono font-bold shrink-0">
        <button
          type="button"
          onClick={() => setSelectedChannel('all')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            selectedChannel === 'all'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-[#00083D] text-slate-300 hover:text-white border border-blue-900'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Kanal: Alle</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChannel('jugend')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            selectedChannel === 'jugend'
              ? 'bg-cyan-500 text-slate-950 font-black shadow'
              : 'bg-[#00083D] text-slate-300 hover:text-white border border-blue-900'
          }`}
        >
          <span>🎒</span>
          <span>Team Jugend</span>
        </button>

        {isJoint && (
          <button
            type="button"
            onClick={() => setSelectedChannel('erwachsene')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedChannel === 'erwachsene'
                ? 'bg-emerald-500 text-slate-950 font-black shadow'
                : 'bg-[#00083D] text-slate-300 hover:text-white border border-blue-900'
            }`}
          >
            <span>🦺</span>
            <span>Team Erwachsene</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setSelectedChannel('leitung')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            selectedChannel === 'leitung'
              ? 'bg-amber-500 text-slate-950 font-black shadow'
              : 'bg-[#00083D] text-slate-300 hover:text-white border border-blue-900'
          }`}
        >
          <span>🛡️</span>
          <span>Übungsleitung</span>
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 font-mono">
            <Radio className="w-8 h-8 text-blue-500/40 mb-2" />
            <span>Funkkanal ist ruhig. Schreibe die erste Übungsnachricht!</span>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentYouthUser?.id;
            const isLeitung = msg.senderTeam === 'leitung';
            const isAdult = msg.senderTeam === 'erwachsene';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${
                  isMe ? 'ml-auto' : 'mr-auto'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-mono">
                  <span className="font-bold text-white">
                    {msg.senderName}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                      isLeitung
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : isAdult
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-600'
                    }`}
                  >
                    {isLeitung ? 'Leitung' : isAdult ? 'Erwachsene' : 'Jugend'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`p-3 rounded-2xl text-xs font-sans leading-relaxed shadow-md ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : isLeitung
                      ? 'bg-amber-950/80 border border-amber-500/70 text-amber-100 rounded-tl-none'
                      : 'bg-[#000E66] border border-blue-900 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chips for Kids */}
      <div className="px-3 py-2 bg-[#000E66]/80 border-t border-blue-900 flex items-center gap-2 overflow-x-auto shrink-0 text-xs font-mono">
        <span className="text-[10px] text-cyan-300 font-bold shrink-0">Schnellfunk:</span>
        <button
          type="button"
          onClick={() => handleQuickChip('Sektor erreicht! 📍')}
          className="px-2.5 py-1 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-slate-200 text-[11px] whitespace-nowrap cursor-pointer transition border border-blue-800"
        >
          📍 Sektor erreicht
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('Verdächtige Spur entdeckt! 🐾')}
          className="px-2.5 py-1 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-slate-200 text-[11px] whitespace-nowrap cursor-pointer transition border border-blue-800"
        >
          🐾 Spur entdeckt
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('Alles in Ordnung! 👍')}
          className="px-2.5 py-1 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-slate-200 text-[11px] whitespace-nowrap cursor-pointer transition border border-blue-800"
        >
          👍 Alles in Ordnung
        </button>
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-[#000E66] border-t border-blue-900 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Funknachricht an [${selectedChannel.toUpperCase()}] senden...`}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 font-sans"
        />
        <button
          type="submit"
          className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition cursor-pointer shadow flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
