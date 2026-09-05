'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * أصوات المنصّة — نبرات مولّدة بـ Web Audio لا ملفات صوتية.
 *
 * لماذا مولّدة؟ لأن ملفات الصوت تُحمَّل وتُخزَّن وتُبطّئ أول تحميل، ونبرة
 * قصيرة كهذه لا تحتاجها. والتوليد يعطي تحكّمًا دقيقًا في النبرة والمدّة بلا
 * أي بايت إضافي على الشبكة.
 *
 * وهي **صامتة افتراضيًا**: صوت يفاجئ الزائر بلا إذنه تجربة سيّئة، والمتصفّحات
 * تمنع التشغيل قبل أول تفاعل على أي حال. من يفعّلها يُحفظ اختياره.
 */
export type SoundName = 'bid' | 'outbid' | 'win' | 'tick' | 'alert' | 'success' | 'offer-sent' | 'offer-in'

/** نغمة كل حدث: ترددات صاعدة للفرح، هابطة للتنبيه. */
const TONES: Record<SoundName, { freq: number[]; duration: number; type: OscillatorType; gain: number }> = {
  // مزايدتك سُجّلت: نغمة صاعدة قصيرة
  bid: { freq: [660, 880], duration: 0.14, type: 'sine', gain: 0.14 },
  // تجاوزك غيرك: نغمة هابطة تنبيهية
  outbid: { freq: [520, 392], duration: 0.24, type: 'triangle', gain: 0.18 },
  // فوز: ثلاث درجات صاعدة
  win: { freq: [523, 659, 784], duration: 0.42, type: 'sine', gain: 0.16 },
  // نبضة الثواني الأخيرة: نقرة خافتة جدًا
  tick: { freq: [1200], duration: 0.045, type: 'square', gain: 0.05 },
  // تنبيه عام
  alert: { freq: [440, 440], duration: 0.2, type: 'triangle', gain: 0.14 },
  // نجاح عملية
  success: { freq: [587, 880], duration: 0.18, type: 'sine', gain: 0.13 },
  // وصلك عرض: جرسٌ لطيف من درجتين، أرفع من نبرة المزايدة فيُميَّز عنها
  'offer-in': { freq: [988, 1319], duration: 0.3, type: 'sine', gain: 0.12 },
  // «أُرسل عرضك» لها مولّدها الخاص أدناه — والقيد هنا ليكتمل الجدول
  'offer-sent': { freq: [880], duration: 0.24, type: 'sine', gain: 0.1 },
}

/**
 * حفيفُ الإرسال — ضجيجٌ أبيض يمرّ بمصفاةٍ تصعد ترددها ثمّ يخفت.
 *
 * صوت «أُرسل» في الهواتف حفيفٌ صاعد لا نغمة: نَفَسٌ يبدأ ثقيلًا وينتهي رفيعًا،
 * فيُقرأ ذهابًا لا تنبيهًا. والنغمات الموقّعة لا تؤدّيه مهما رُتّبت، فيُصنع من
 * ضجيجٍ مولَّد تُحرّك مصفاتُه من ٤٠٠ إلى ٣٥٠٠ هرتز في ربع ثانية.
 *
 * ومولَّدٌ لا منسوخ: الأصل الذي في الهواتف عملٌ مملوك، وهذا يشبهه في الإحساس
 * ولا يأخذ منه شيئًا.
 */
function playWhoosh(ctx: AudioContext): void {
  const duration = 0.26
  const now = ctx.currentTime
  const frames = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) channel[i] = Math.random() * 2 - 1

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.1
  filter.frequency.setValueAtTime(400, now)
  filter.frequency.exponentialRampToValueAtTime(3500, now + duration)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.045)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(now)
  source.stop(now + duration + 0.02)
}

const STORAGE_KEY = 'pa_sound'

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context ??= new Ctor()
    // المتصفّح يوقف السياق حتى أول تفاعل — نستأنفه عند أول تشغيل
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** يعزف نبرة واحدة. يفشل بصمت: الصوت زينة لا وظيفة. */
export function playTone(name: SoundName): void {
  const ctx = audioContext()
  if (!ctx) return

  if (name === 'offer-sent') {
    try {
      playWhoosh(ctx)
    } catch {
      // جهاز لا يدعم الصوت — نتجاهل
    }
    return
  }

  const tone = TONES[name]

  try {
    const now = ctx.currentTime
    const step = tone.duration / tone.freq.length

    tone.freq.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = tone.type
      oscillator.frequency.setValueAtTime(frequency, now + index * step)

      // انحدار أُسّي يمنع الطقطقة التي يُحدثها القطع المفاجئ
      gain.gain.setValueAtTime(0.0001, now + index * step)
      gain.gain.exponentialRampToValueAtTime(tone.gain, now + index * step + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (index + 1) * step)

      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(now + index * step)
      oscillator.stop(now + (index + 1) * step + 0.02)
    })
  } catch {
    // جهاز لا يدعم الصوت — نتجاهل
  }
}

/**
 * تفضيل الصوت المحفوظ ودالة العزف.
 * العزف لا يفعل شيئًا وهو مُطفأ، فيستدعيه المكوّن بلا شروط.
 */
export function useSound() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'on')
    } catch {
      // متصفّح يمنع التخزين — يبقى صامتًا
    }
  }, [])

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        // لا شيء نفعله
      }
      if (next) playTone('success')
      return next
    })
  }, [])

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled) return
      playTone(name)
    },
    [enabled],
  )

  return { enabled, toggle, play }
}
