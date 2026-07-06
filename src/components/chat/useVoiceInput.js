// === useVoiceInput.js — chat voice recording + whisper transcription ===
// Moved verbatim from AIChat.jsx (P2.1 split). Owns all voice state/refs and
// its own unmount cleanup. The ONLY textual change from the source: the
// transcribeAndSend auto-send call `handleSend(…)` becomes `onSend(…)`.
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { transcribeAudio } from '../../api'

export default function useVoiceInput({ input, setInput, inputRef, onSend }) {
  const { t } = useLanguage()

  // ── Voice input state ──────────────────────────────────────────────────────
  // 'idle' | 'listening' | 'processing' | 'error'
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceError, setVoiceError] = useState('')
  const [voiceSeconds, setVoiceSeconds] = useState(0) // recording duration counter
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const silenceTimerRef = useRef(null) // 4s auto-stop timer
  const recordTickRef = useRef(null) // seconds counter interval
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const silenceFrameRef = useRef(null) // rAF for silence detection
  const streamRef = useRef(null)

  // ── Voice helpers ──────────────────────────────────────────────────────────
  function stopVoiceRecording() {
    clearTimeout(silenceTimerRef.current)
    clearInterval(recordTickRef.current)
    cancelAnimationFrame(silenceFrameRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
  }

  async function transcribeAndSend(chunks, autoSend) {
    if (!chunks.length) {
      setVoiceState('idle')
      return
    }
    setVoiceState('processing')
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')
      const { data } = await transcribeAudio(formData)
      const text = data.text?.trim()
      if (!text) {
        setVoiceState('idle')
        return
      }
      setInput((prev) => (prev ? prev + ' ' : '') + text)
      setVoiceState('idle')
      if (autoSend) {
        // small delay so state settles, then fire send with the full new text
        setTimeout(() => onSend((input ? input + ' ' : '') + text), 80)
      } else {
        inputRef.current?.focus()
      }
    } catch (err) {
      setVoiceError(err.message || 'Transcription failed')
      setVoiceState('error')
      setTimeout(() => {
        setVoiceState('idle')
        setVoiceError('')
      }, 3500)
    }
  }

  // ── Voice input toggle ─────────────────────────────────────────────────────
  const SILENCE_MS = 4000 // auto-stop after 4 s of silence
  const SILENCE_THRESHOLD = 8 // RMS below this = silent (0–255 scale)

  const handleVoice = async () => {
    // Stop if already recording
    if (voiceState === 'listening') {
      stopVoiceRecording()
      const chunks = [...audioChunksRef.current]
      audioChunksRef.current = []
      setVoiceState('idle')
      setVoiceSeconds(0)
      await transcribeAndSend(chunks, false)
      return
    }
    if (voiceState === 'processing') return

    setVoiceError('')
    audioChunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      setVoiceError('Microphone access denied')
      setVoiceState('error')
      setTimeout(() => {
        setVoiceState('idle')
        setVoiceError('')
      }, 3500)
      return
    }
    streamRef.current = stream

    // ── Silence detection via AnalyserNode ─────────────────────────────────
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser
    const dataArr = new Uint8Array(analyser.frequencyBinCount)

    let silentSince = Date.now()
    let hasSpeech = false

    function checkSilence() {
      analyser.getByteTimeDomainData(dataArr)
      // RMS of signal around 128 (silence baseline)
      let sum = 0
      for (let i = 0; i < dataArr.length; i++) sum += Math.abs(dataArr[i] - 128)
      const rms = sum / dataArr.length

      if (rms > SILENCE_THRESHOLD) {
        silentSince = Date.now()
        hasSpeech = true
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(async () => {
          // 4 s of silence after speech → auto-stop + auto-send
          stopVoiceRecording()
          const chunks = [...audioChunksRef.current]
          audioChunksRef.current = []
          setVoiceState('idle')
          setVoiceSeconds(0)
          await transcribeAndSend(chunks, true)
        }, SILENCE_MS)
      }
      silenceFrameRef.current = requestAnimationFrame(checkSilence)
    }
    silenceFrameRef.current = requestAnimationFrame(checkSilence)

    // ── MediaRecorder ───────────────────────────────────────────────────────
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) audioChunksRef.current.push(e.data)
    }
    recorder.start(250) // chunk every 250 ms so we always get data

    setVoiceState('listening')
    setVoiceSeconds(0)
    recordTickRef.current = setInterval(() => setVoiceSeconds((s) => s + 1), 1000)
  }

  // voice half of the old AIChat unmount cleanup (line 1890 effect)
  useEffect(() => {
    return () => stopVoiceRecording()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { voiceState, voiceError, voiceSeconds, handleVoice }
}
