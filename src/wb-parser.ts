// src/main.ts
import { WildberriesClient } from './wildberries-client';
import { FeedbackStorage } from './storage';
import { handleFetchError, FeedbackFetchError, ErrorType } from './errors';

async function main() {
  const imtId = process.argv[2];
  
  if (!imtId) {
    console.error('❌ Укажите imtId товара');
    console.log('Использование: npm start -- <imtId>');
    console.log('Пример: npm start -- 12345678');
    process.exit(1);
  }

  console.log(`\n🔍 Сбор отзывов для товара imtId=${imtId}\n`);

  const client = new WildberriesClient();
  const storage = new FeedbackStorage();

  try {
    await storage.init();
    
    // 1. Получение данных
    console.log('📡 Выполняю запрос к API Wildberries...');
    const data = await client.fetchFeedbacks(imtId);

    // 2. Сохранение сырых данных
    await storage.saveRaw(data, imtId);

    // 3. Сохранение обработанных данных
    await storage.saveProcessed(data, imtId);

    // 4. Вывод статистики
    const stats = storage.generateStats(data);
    console.log('\n╔═══════════════════════════════════╗');
    console.log('║        📊 СТАТИСТИКА             ║');
    console.log('╚═══════════════════════════════════╝');
    console.log(`📝 Всего отзывов:      ${stats.totalFeedbacks}`);
    console.log(`⭐ Средняя оценка:     ${stats.averageRating}`);
    console.log(`📄 С текстом:         ${stats.withText}`);
    console.log(`📷 С фото:            ${stats.withPhoto}`);
    console.log(`💬 Средняя длина:     ${stats.avgTextLength} символов`);
    
    console.log('\n📅 По месяцам:');
    Object.entries(stats.byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, count]) => {
        console.log(`   ${month}: ${count} отзывов`);
      });

    console.log('\n✅ Сбор данных успешно завершён!');

  } catch (error) {
    try {
      handleFetchError(error, imtId);
    } catch (handledError) {
      if (handledError instanceof FeedbackFetchError) {
        console.error(`\n❌ ${handledError.type}: ${handledError.message}`);
        
        // Рекомендации по исправлению
        switch (handledError.type) {
          case ErrorType.INVALID_IMT_ID:
            console.log('💡 Проверьте правильность imtId на странице товара Wildberries');
            break;
          case ErrorType.TIMEOUT:
          case ErrorType.NETWORK_ERROR:
            console.log('💡 Проверьте интернет-соединение или используйте VPN');
            break;
          case ErrorType.SOURCE_SERVER_ERROR:
            console.log('💡 Сервер WB временно недоступен, попробуйте позже');
            break;
          case ErrorType.STRUCTURE_CHANGED:
            console.log('💡 Wildberries изменил формат ответа. Требуется обновление парсера.');
            break;
        }
      } else {
        console.error('❌ Непредвиденная ошибка:', handledError);
      }
      process.exit(1);
    }
  }
}

main();