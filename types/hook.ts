// types/hooks.ts
import { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { ApiResponse } from './api';

export type UseDataResult<T> = UseQueryResult<T, Error>;

export type UseMutationResultWithData<TData, TVariables> = UseMutationResult<
  ApiResponse<TData>,
  Error,
  TVariables
>;

export interface UsePaginationResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  page: number;
  totalPages: number;
  totalItems: number;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
}

export interface UseFilterResult<T> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  resetFilters: () => void;
  clearFilter: (key: keyof T) => void;
}