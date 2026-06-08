/**
 * Let TypeScript accept side-effect CSS imports.
 *
 * The dialog imports its stylesheet for its side effect only.
 * Vite handles the real loading at build time. TypeScript just
 * needs to know the module exists.
 */
declare module "*.css";
