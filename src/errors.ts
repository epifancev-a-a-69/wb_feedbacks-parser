// src/errors.ts
import axios, { AxiosError } from 'axios';

export enum ErrorType {
  INVALID_IMT_ID = 'INVALID_IMT_ID',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  SOURCE_SERVER_ERROR = 'SOURCE_SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  STRUCTURE_CHANGED = 'STRUCTURE_CHANGED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export class FeedbackFetchError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'FeedbackFetchError';
  }
}

export function handleFetchError(error: unknown, imtId: string | number): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    // Таймаут
    if (axiosError.code === 'ECONNABORTED') {
      throw new FeedbackFetchError(
        ErrorType.TIMEOUT,
        `Превышено время ожидания ответа для imtId ${imtId}`,
        axiosError
      );
    }

    // Ответ получен, но с ошибкой
    if (axiosError.response) {
      const status = axiosError.response.status;

      if (status === 404) {
        throw new FeedbackFetchError(
          ErrorType.INVALID_IMT_ID,
          `Товар с imtId ${imtId} не найден. Проверьте идентификатор.`,
          axiosError
        );
      }

      if (status >= 500) {
        throw new FeedbackFetchError(
          ErrorType.SOURCE_SERVER_ERROR,
          `Ошибка на стороне Wildberries (HTTP ${status}) для imtId ${imtId}`,
          axiosError
        );
      }

      if (status >= 400) {
        throw new FeedbackFetchError(
          ErrorType.CLIENT_ERROR,
          `Клиентская ошибка (HTTP ${status}): ${axiosError.message}`,
          axiosError
        );
      }
    }

    // Запрос сделан, но ответ не получен
    if (axiosError.request) {
      throw new FeedbackFetchError(
        ErrorType.NETWORK_ERROR,
        `Нет ответа от сервера для imtId ${imtId}. Проверьте сетевое подключение.`,
        axiosError
      );
    }
  }

  // Любая другая ошибка
  if (error instanceof Error) {
    if (error.message.includes('Некорректная структура ответа')) {
      throw new FeedbackFetchError(
        ErrorType.STRUCTURE_CHANGED,
        `Изменение структуры ответа Wildberries: ${error.message}`,
        error
      );
    }

    if (error.message.includes('пустой ответ') || error.message.includes('empty')) {
      throw new FeedbackFetchError(
        ErrorType.EMPTY_RESPONSE,
        `Пустой ответ от Wildberries для imtId ${imtId}`,
        error
      );
    }
  }

  throw new FeedbackFetchError(
    ErrorType.CLIENT_ERROR,
    `Неизвестная ошибка: ${(error as Error)?.message || 'неизвестно'}`,
    error instanceof Error ? error : undefined
  );
}