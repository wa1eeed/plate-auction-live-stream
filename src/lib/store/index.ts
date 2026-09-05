import { emptyDatabase, MemoryStore } from './memory-store'
import { seedDatabase } from './seed'
import { applySettingsFile, writeSettingsFile } from './settings-file'
import type { AuctionStore } from './types'

/**
 * مثيل وحيد للتخزين. يُحفظ على `globalThis` حتى لا يُعاد إنشاؤه مع كل
 * إعادة تحميل ساخنة في وضع التطوير (وإلا فقدنا بيانات وضع Demo).
 *
 * التنفيذ الحالي في الذاكرة. الواجهة `AuctionStore` مجرّدة بالكامل، فإضافة
 * تنفيذ PostgreSQL لا تتطلّب تعديل أي مكوّن واجهة.
 */
const globalRef = globalThis as typeof globalThis & { __auctionStore?: AuctionStore }

function createStore(): AuctionStore {
  const db = emptyDatabase()
  seedDatabase(db)
  /*
   * البذرة أوّلًا ثمّ ما ضبطته الإدارة فوقها.
   *
   * الترتيب مقصود: البذرة تملأ كل حقلٍ بافتراضيّه — ومنها الحقول التي أُضيفت
   * في نسخةٍ أحدث من الملفّ المحفوظ — ثمّ يحلّ المحفوظ محلّ ما حُفظ منه وحده.
   * ولو قُلبا لبقيت الحقول الجديدة فارغةً على نسخةٍ مرقّاة.
   */
  applySettingsFile(db)
  return new MemoryStore(db).onSettingsChange(writeSettingsFile)
}

export function getStore(): AuctionStore {
  if (!globalRef.__auctionStore) {
    globalRef.__auctionStore = createStore()
  }
  return globalRef.__auctionStore
}

/** يُستخدم في الاختبارات فقط لإعادة ضبط الحالة. */
export function resetStoreForTests(store?: AuctionStore): void {
  globalRef.__auctionStore = store
}

export function createSeededMemoryStore(): MemoryStore {
  const db = emptyDatabase()
  seedDatabase(db)
  return new MemoryStore(db)
}

export type { AuctionStore }
