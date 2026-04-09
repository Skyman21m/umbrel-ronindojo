export type PageProps<T = {}> = T &
  (
    | {
        withLayout: true;
        layoutTitle: string;
      }
    | {
        withLayout: false;
      }
  );
