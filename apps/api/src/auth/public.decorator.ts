import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans JWT. Par défaut, toutes les routes exigent d'être connecté. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
