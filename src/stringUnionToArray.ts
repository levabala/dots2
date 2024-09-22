// https://stackoverflow.com/a/70694878

type ValueOf<T> = T[keyof T];

type NonEmptyArray<T> = [T, ...T[]];

type MustInclude<T, U extends T[]> = [T] extends [ValueOf<U>] ? U : never;

export function stringUnionToArray<T>() {
    return <U extends NonEmptyArray<T>>(...elements: MustInclude<T, U>) =>
        elements;
}
