/**
 * قفل غير متزامن بسيط لضمان تسلسل العمليات الحرجة (المزايدات) داخل
 * وضع Demo. في وضع Supabase تتكفّل دالة `place_bid` بالذرّية على مستوى
 * قاعدة البيانات.
 */
export class KeyedMutex {
  private readonly chains = new Map<string, Promise<void>>()

  async run<T>(key: string, task: () => Promise<T> | T): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve()

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const chain = previous.then(() => gate)
    this.chains.set(key, chain)

    await previous
    try {
      return await task()
    } finally {
      release()
      // تنظيف السلسلة عندما لا يكون هناك منتظرون
      void chain.then(() => {
        if (this.chains.get(key) === chain) this.chains.delete(key)
      })
    }
  }
}
