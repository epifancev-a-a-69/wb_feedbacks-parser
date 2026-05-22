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
