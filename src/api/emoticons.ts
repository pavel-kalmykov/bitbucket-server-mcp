import type { ApiContext } from "./context.js";

export interface SearchEmoticonsParams {
  query: string;
}

export interface Emoticon {
  shortcut: string;
}

export function emoticonsApi(ctx: ApiContext) {
  return {
    async search({ query }: SearchEmoticonsParams): Promise<Emoticon[]> {
      const data = await ctx.http.emoticons
        .get("search", { searchParams: { query } })
        .json<{ values: Emoticon[] }>();

      return data.values;
    },
  };
}

export type EmoticonsApi = ReturnType<typeof emoticonsApi>;
