/*
// src/wildberries-client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { WbFeedbackResponse } from './types/wb-feedback.types';

export class WildberriesClient {
  private readonly client: AxiosInstance;
  private readonly baseUrls = [
    'https://feedbacks1.wb.ru/feedbacks/v2',
    'https://feedbacks2.wb.ru/feedbacks/v2',
    'https://feedbacks0.wb.ru/feedbacks/v2',
  ];

  constructor() {
    this.client = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, * /*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000,
    });
  }

  /**
   * Получение отзывов по imtId с fallback по зеркалам
   * /
  async fetchFeedbacks(imtId: string | number): Promise<WbFeedbackResponse> {
    let lastError: Error | null = null;

    for (const baseUrl of this.baseUrls) {
      try {
        const url = `${baseUrl}/${imtId}`;
        console.log(`[REQUEST] ${url}`);
        
        const response = await this.client.get<WbFeedbackResponse>(url);
        
        if (!response.data || !response.data.feedbacks) {
          throw new Error('Некорректная структура ответа: отсутствует поле feedbacks');
        }

        console.log(`[SUCCESS] Получено ${response.data.feedbackCount} отзывов`);
        return response.data;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`[WARN] Зеркало ${baseUrl} недоступно: ${(error as Error).message}`);
        continue;
      }
    }

    throw lastError || new Error('Все зеркала недоступны');
  }
}
*/

// src/wildberries-client.ts
import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';
import { WbFeedbackResponse } from './types/wb-feedback.types';

@Injectable()
export class WildberriesClient {
  private readonly client: AxiosInstance;
  private readonly baseUrls = [
    'https://feedbacks1.wb.ru/feedbacks/v2',
    'https://feedbacks2.wb.ru/feedbacks/v2',
    'https://feedbacks0.wb.ru/feedbacks/v2',
  ];

  constructor() {
    this.client = axios.create({
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000,
    });
  }

  /**
   * Получает одну страницу отзывов
   */
  private async fetchPage(
    baseUrl: string,
    imtId: string | number,
    skip: number,
    take: number,
  ): Promise<WbFeedbackResponse> {
    const url = `${baseUrl}/${imtId}?skip=${skip}&take=${take}`;
    console.log(`[REQUEST] ${url}`);

    const response = await this.client.get<WbFeedbackResponse>(url);

    if (!response.data || !response.data.feedbacks) {
      throw new Error('Некорректная структура ответа: отсутствует поле feedbacks');
    }

    return response.data;
  }

  /**
   * Получение всех отзывов по imtId с пагинацией
   * Собирает все отзывы, обходя все страницы
   */
  async fetchFeedbacks(imtId: string | number): Promise<WbFeedbackResponse> {
    const take = 5000; // WB максимум отдаёт около 5000 за раз
    let allFeedbacks: WbFeedbackResponse['feedbacks'] = [];
    let totalCount = 0;
    let skip = 0;
    let firstPageData: WbFeedbackResponse | null = null;

    // Пробуем зеркала по очереди
    for (const baseUrl of this.baseUrls) {
      try {
        console.log(`[INFO] Использую зеркало: ${baseUrl}`);
        
        // Запрашиваем страницы пока не соберём все отзывы
        while (true) {
          const page = await this.fetchPage(baseUrl, imtId, skip, take);

          // Сохраняем данные первой страницы (с мета-информацией)
          if (!firstPageData) {
            firstPageData = page;
            totalCount = page.feedbackCount;
            console.log(`[INFO] Всего отзывов у товара: ${totalCount}`);
          }

          const receivedCount = page.feedbacks.length;
          allFeedbacks = allFeedbacks.concat(page.feedbacks);
          
          console.log(
            `[INFO] Получено ${receivedCount} отзывов (skip=${skip}), всего собрано: ${allFeedbacks.length}`,
          );

          // Если получили меньше, чем запрашивали — достигли конца
          if (receivedCount < take) {
            console.log(`[INFO] Достигнут конец списка отзывов`);
            break;
          }

          // Если собрали все — выходим
          if (allFeedbacks.length >= totalCount) {
            console.log(`[INFO] Собраны все отзывы`);
            break;
          }

          skip += take;
        }

        // Собираем финальный ответ
        const result: WbFeedbackResponse = {
          ...firstPageData!,
          feedbacks: allFeedbacks,
        };

        console.log(
          `[SUCCESS] Итого собрано: ${allFeedbacks.length} из ${totalCount} отзывов`,
        );
        return result;

      } catch (error) {
        console.warn(
          `[WARN] Зеркало ${baseUrl} недоступно: ${(error as Error).message}`,
        );
        // Сбрасываем для следующего зеркала
        allFeedbacks = [];
        skip = 0;
        firstPageData = null;
        continue;
      }
    }

    throw new Error('Все зеркала Wildberries недоступны');
  }

  /**
   * Получение только одной страницы отзывов (для быстрых запросов)
   */
  async fetchFeedbacksSinglePage(
    imtId: string | number,
    skip: number = 0,
    take: number = 5000,
  ): Promise<WbFeedbackResponse> {
    for (const baseUrl of this.baseUrls) {
      try {
        const data = await this.fetchPage(baseUrl, imtId, skip, take);
        console.log(`[SUCCESS] Получено ${data.feedbacks.length} отзывов`);
        return data;
      } catch (error) {
        console.warn(
          `[WARN] Зеркало ${baseUrl} недоступно: ${(error as Error).message}`,
        );
        continue;
      }
    }

    throw new Error('Все зеркала Wildberries недоступны');
  }
}


/*
// src/wildberries-client.ts
import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';
import { WbFeedbackResponse } from './types/wb-feedback.types';

@Injectable()
export class WildberriesClient {
  private readonly client: AxiosInstance;
  private readonly baseUrls = [
    'https://feedbacks1.wb.ru/feedbacks/v2',
    'https://feedbacks2.wb.ru/feedbacks/v2',
    'https://feedbacks0.wb.ru/feedbacks/v2',
  ];

  constructor() {
    this.client = axios.create({
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, * /*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 15000,
    });
  }

  /**
   * Получает одну страницу отзывов
   * /
  private async fetchPage(
    baseUrl: string,
    imtId: string | number,
    skip: number,
    take: number,
    sort: string = 'dateDesc',
  ): Promise<WbFeedbackResponse> {
    const url = `${baseUrl}/${imtId}?skip=${skip}&take=${take}&sort=${sort}`;
    console.log(`[REQUEST] ${url}`);

    const response = await this.client.get<WbFeedbackResponse>(url);

    if (!response.data || !response.data.feedbacks) {
      throw new Error('Некорректная структура ответа: отсутствует поле feedbacks');
    }

    return response.data;
  }

  /**
   * Получение всех отзывов по imtId с пагинацией
   * Пробует разные сортировки для получения большего количества
   * /
  async fetchFeedbacks(imtId: string | number): Promise<WbFeedbackResponse> {
    const take = 5000;
    let allFeedbacksMap = new Map<string, WbFeedbackResponse['feedbacks'][0]>();
    let firstPageData: WbFeedbackResponse | null = null;

    // Пробуем разные сортировки
    const sortOrders = ['dateDesc', 'dateAsc', 'votesDesc'];
    
    for (const baseUrl of this.baseUrls) {
      for (const sort of sortOrders) {
        try {
          console.log(`[INFO] Зеркало: ${baseUrl}, сортировка: ${sort}`);
          let skip = 0;

          while (true) {
            const page = await this.fetchPage(baseUrl, imtId, skip, take, sort);

            if (!firstPageData) {
              firstPageData = page;
              console.log(`[INFO] Всего отзывов у товара: ${page.feedbackCount}`);
            }

            const receivedCount = page.feedbacks.length;
            
            // Добавляем уникальные отзывы по ID
            for (const fb of page.feedbacks) {
              if (!allFeedbacksMap.has(fb.id)) {
                allFeedbacksMap.set(fb.id, fb);
              }
            }

            const uniqueCount = allFeedbacksMap.size;
            console.log(
              `[INFO] Получено ${receivedCount} (skip=${skip}, sort=${sort}), уникальных всего: ${uniqueCount}`,
            );

            // Если получили меньше, чем запрашивали — конец
            if (receivedCount < take) {
              console.log(`[INFO] Достигнут конец страниц для sort=${sort}`);
              break;
            }

            // Пауза чтобы не забанили
            await this.delay(200);
            skip += take;
          }

        } catch (error) {
          console.warn(`[WARN] Ошибка (${baseUrl}, sort=${sort}): ${(error as Error).message}`);
          continue;
        }
      }
    }

    if (!firstPageData) {
      throw new Error('Не удалось получить данные ни с одного зеркала');
    }

    if (allFeedbacksMap.size === 0) {
      throw new Error('Не удалось собрать ни одного отзыва');
    }

    const allFeedbacks = Array.from(allFeedbacksMap.values());
    
    // Сортируем по дате (сначала новые)
    allFeedbacks.sort((a, b) => 
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );

    console.log(`[SUCCESS] Всего уникальных отзывов: ${allFeedbacks.length} из ${firstPageData.feedbackCount}`);

    return {
      ...firstPageData,
      feedbacks: allFeedbacks,
      feedbackCount: allFeedbacks.length,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
  */