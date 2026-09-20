import { emptyDatabase, MemoryStore } from './memory-store'
import { isPostgresConfigured } from './pg/client'
import { PostgresStore } from './pg/store'
import { seedDatabase } from './seed'
import { applySettingsFile, writeSettingsFile } from './settings-file'
import type { AuctionStore } from './types'

/**
 * مثيل وحيد للتخزين. يُحفظ على `globalThis` حتى لا يُعاد إنشاؤه مع كل
 * إعادة تحميل ساخنة في وضع التطوير (وإلا فقدنا بيانات وضع Demo).
 *
 * **والاختيار بوجود `DATABASE_URL` لا بمتغيّرٍ يُكتب باليد.** رايةٌ منفصلة
 * تعني حالةً رابعة: رابطٌ مضبوطٌ وراية مطفأة — فيُقلع التطبيق على الذاكرة
 * بجانب قاعدةٍ عامرة، ولا يُكتشف ذلك إلّا بعد أن تضيع بيانات يوم.
 */
const globalRef = globalThis as typeof globalThis & { __auctionStore?: AuctionStore }

/**
 * البناء لا يلمس القاعدة.
 *
 * `next build` يُولّد صفحاتٍ ساكنة — صفحةَ «غير موجود» وأخواتِها — وتخطيطُ
 * الجذر يقرأ الهويّة في `generateMetadata`. فيقع الاتّصال **داخل بناء الصورة**،
 * حيث لا قاعدة أصلًا (أو لا جداول فيها بعد: الترحيل يجري عند إقلاع الخادم).
 * فيسقط البناء بـ`relation "settings" does not exist` أو بتعذّر الاتّصال.
 *
 * ولا بيانات يُحتاج إليها هناك: ما يُولَّد ساكنًا قشرةٌ لا محتوى، وكلُّ صفحةٍ
 * تحمل بياناتٍ حقيقيّة **ديناميكيّة** تُصيَّر عند الطلب.
 *
 * وثمنُه ظاهر: صفحة «غير موجود» تحمل هويّةً افتراضية لا المضبوطة — وهي الصفحة
 * الوحيدة التي تُولَّد ساكنةً وتقرأ الهويّة.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

function createStore(): AuctionStore {
  if (isPostgresConfigured() && !isBuildPhase()) return new PostgresStore()

  /* في البناء: ذاكرةٌ بالافتراضيّات بلا بذرة — قشرةٌ نظيفة لا بيانات وهمية */
  if (isBuildPhase()) return new MemoryStore(emptyDatabase())

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
