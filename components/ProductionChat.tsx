
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Persona, PersonaState, ChatMessage, Voice } from '../types';
import * as geminiService from '../services/geminiService';
import { SendIcon, PlusIcon, VolumeUpIcon, CogIcon, MicrophoneIcon } from './icons';

interface ProductionChatProps {
  personas: Persona[];
  onAddPersona: () => void;
  voices: Voice[];
  onManageVoices: () => void;
}

const defaultPersonaState: PersonaState = {
  name: 'AI Assistant',
  role: 'A helpful and friendly AI assistant.',
  tone: 'Clear, helpful, and polite.',
  personality: 'Knowledgeable and patient.',
  worldview: 'The digital realm.',
  experience: 'Trained on a vast amount of text data.',
  other: '',
  summary: 'A general-purpose AI assistant.',
};

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = false; 
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
}

export const ProductionChat: React.FC<ProductionChatProps> = ({ personas, onAddPersona, voices, onManageVoices }) => {
    const [selectedPersonaId, setSelectedPersonaId] = useState<string>('default');
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('none');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    useEffect(() => {
      setChatHistory([{ role: 'model', parts: [{ text: 'こんにちは！何かお話ししましょう。' }] }]);
    }, []);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatHistory]);
    
    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            if (audioRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(audioRef.current.src);
            }
            audioRef.current = null;
        }
    },[]);

    const speak = useCallback(async (text: string) => {
        const voice = voices.find(v => v.id === selectedVoiceId);
        if (!isTtsEnabled || !text || !voice) return;
        
        stopPlayback();

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    token: voice.token,
                    voiceId: voice.voiceId,
                }),
            });

            if (!response.ok) {
                 let errorMessage = `Failed to get audio from server (status: ${response.status})`;
                 try {
                     // Try to get a more specific error message from our proxy's JSON response
                     const errorJson = await response.json();
                     errorMessage = errorJson.error || errorJson.message || errorMessage;
                 } catch (e) {
                     // Response was not JSON, use the raw text if available
                     const errorText = await response.text();
                     if (errorText) errorMessage = errorText;
                 }
                 throw new Error(errorMessage);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.play().catch(err => console.error("Audio playback failed:", err));
            audio.onended = () => {
                if (audioRef.current) {
                  URL.revokeObjectURL(audioRef.current.src);
                  audioRef.current = null;
                }
            };
        } catch (error) {
            console.error('Failed to play audio:', error);
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `[音声の再生に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}]` }] };
            setChatHistory(prev => [...prev, errorMessage]);
        }
    }, [isTtsEnabled, stopPlayback, selectedVoiceId, voices]);

    const handleSendMessage = async () => {
        const messageText = userInput.trim();
        if (!messageText || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
        const newHistory = [...chatHistory, newUserMessage];
        setChatHistory(newHistory);
        setUserInput('');
        setIsLoading(true);

        const activePersona = personas.find(p => p.id === selectedPersonaId) || defaultPersonaState;

        try {
            const responseText = await geminiService.getPersonaChatResponse(activePersona, newHistory);
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
            setChatHistory(prev => [...prev, modelMessage]);
            speak(responseText);
        } catch (error) {
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: "申し訳ありません、エラーが発生しました。" }] };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePersonaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPersonaId = e.target.value;
        setSelectedPersonaId(newPersonaId);
        const activePersona = personas.find(p => p.id === newPersonaId) || defaultPersonaState;
        setChatHistory([{ role: 'model', parts: [{ text: `こんにちは、${activePersona.name}です。何かお話ししましょう。` }] }]);
        stopPlayback();
    };

    const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedVoiceId(e.target.value);
        stopPlayback();
    };

    const handleToggleListen = () => {
        if (!recognition) return;
        if (isListening) {
            recognition.stop();
            setIsListening(false);
        } else {
            recognition.start();
            setIsListening(true);
        }
    };

    useEffect(() => {
        if (!recognition) return;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setUserInput(prev => prev + transcript);
        };

        return () => {
            recognition.onstart = null;
            recognition.onend = null;
            recognition.onerror = null;
            recognition.onresult = null;
        };
    }, []);

    return (
        <div className="bg-gray-800 rounded-lg shadow-2xl w-full h-full flex flex-col">
            <header className="flex-shrink-0 flex flex-col md:flex-row justify-between md:items-center p-4 border-b border-gray-700 gap-4">
                <h2 className="text-xl font-bold text-white self-start md:self-center">AI Chat</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                     <select id="persona-select" value={selectedPersonaId} onChange={handlePersonaChange} className="bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="default">Default Assistant</option>
                        {personas.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                    <button onClick={onAddPersona} className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 transition-colors rounded-md text-sm"><PlusIcon /> Add Persona</button>
                    <select id="voice-select" value={selectedVoiceId} onChange={handleVoiceChange} className="bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="none">No Voice</option>
                        {voices.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
                    </select>
                    <button onClick={onManageVoices} className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 transition-colors rounded-md text-sm"><CogIcon/> Manage Voices</button>
                </div>
            </header>

            <div ref={chatBoxRef} className="flex-grow p-4 overflow-y-auto space-y-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && (
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                { (personas.find(p => p.id === selectedPersonaId) || defaultPersonaState).name.charAt(0) }
                            </div>
                        )}
                        <div className={`max-w-md lg:max-w-xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
                        </div>
                    </div>
                ))}
                 {isLoading && (
                    <div className="flex items-end gap-2 justify-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            { (personas.find(p => p.id === selectedPersonaId) || defaultPersonaState).name.charAt(0) }
                        </div>
                        <div className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 p-4 border-t border-gray-700 flex items-center gap-2">
                <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="メッセージを入力..." className="w-full bg-gray-700/80 rounded-md p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={isLoading} />
                 <button title="Toggle Voice Input" onClick={handleToggleListen} disabled={!recognition} className={`p-3 transition-colors rounded-md shadow-lg flex items-center justify-center ${isListening ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'} disabled:bg-gray-700/50 disabled:cursor-not-allowed`}>
                    <MicrophoneIcon />
                </button>
                <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()} className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed transition-colors rounded-md shadow-lg flex items-center justify-center"><SendIcon /></button>
                <div className="flex items-center gap-2 text-gray-400">
                    <VolumeUpIcon className="w-5 h-5"/>
                    <label htmlFor="tts-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="tts-toggle" className="sr-only peer" checked={isTtsEnabled} onChange={() => setIsTtsEnabled(!isTtsEnabled)} />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};
