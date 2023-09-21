/**
 * @since 1.0.0
 */
import * as internalRegistry from "@effect-rx/rx/internal/registry"
import * as Result from "@effect-rx/rx/Result"
import * as Chunk from "@effect/data/Chunk"
import { dual, pipe } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import * as Inspectable from "@effect/data/Inspectable"
import * as Option from "@effect/data/Option"
import { type Pipeable, pipeArguments } from "@effect/data/Pipeable"
import { NoSuchElementException } from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Layer from "@effect/io/Layer"
import * as Runtime from "@effect/io/Runtime"
import * as Scope from "@effect/io/Scope"
import * as Stream from "@effect/stream/Stream"

/**
 * @since 1.0.0
 * @category type ids
 */
export const TypeId = Symbol.for("@effect-rx/rx/Rx")

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface Rx<A> extends Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: TypeId
  readonly keepAlive: boolean
  readonly read: Rx.Read<A>
  readonly refresh: Rx.Refresh
  readonly label?: readonly [name: string, stack: string]
}

/**
 * @since 1.0.0
 * @category models
 */
export declare namespace Rx {
  /**
   * @since 1.0.0
   * @category models
   */
  export type Read<A> = (
    get: Rx.Get,
    ctx: Context
  ) => A

  /**
   * @since 1.0.0
   * @category models
   */
  export type ReadFn<Arg, A> = (
    arg: Arg,
    get: Rx.Get,
    ctx: Context
  ) => A

  /**
   * @since 1.0.0
   * @category models
   */
  export type Write<R, W> = (
    get: Rx.Get,
    set: Rx.Set,
    setSelf: (_: R) => void,
    refreshSelf: () => void,
    value: W
  ) => void

  /**
   * @since 1.0.0
   * @category models
   */
  export type Refresh = (f: <A>(rx: Rx<A>) => void) => void

  /**
   * @since 1.0.0
   * @category models
   */
  export type Get = <A>(rx: Rx<A>) => A

  /**
   * @since 1.0.0
   * @category models
   */
  export type GetResult = <E, A>(rx: Rx<Result.Result<E, A>>) => Exit.Exit<E | NoSuchElementException, A>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Set = <R, W>(rx: Writable<R, W>, value: W) => void

  /**
   * @since 1.0.0
   * @category models
   */
  export type RefreshRx = <A>(rx: Rx<A> & Refreshable) => void

  /**
   * @since 1.0.0
   * @category models
   */
  export type Mount = <A>(rx: Rx<A>) => () => void

  /**
   * @since 1.0.0
   * @category models
   */
  export type Subscribe = <A>(rx: Rx<A>, f: (_: A) => void, options?: {
    readonly immediate?: boolean
  }) => () => void

  /**
   * @since 1.0.0
   * @category models
   */
  export type SubscribeGetter = <A>(rx: Rx<A>, f: () => void) => readonly [get: () => A, unmount: () => void]
}

/**
 * @since 1.0.0
 * @category type ids
 */
export const RefreshableTypeId = Symbol.for("@effect-rx/rx/Rx/Refreshable")

/**
 * @since 1.0.0
 * @category type ids
 */
export type RefreshableTypeId = typeof RefreshableTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface Refreshable {
  readonly [RefreshableTypeId]: RefreshableTypeId
}

/**
 * @since 1.0.0
 * @category type ids
 */
export const WritableTypeId = Symbol.for("@effect-rx/rx/Rx/Writable")

/**
 * @since 1.0.0
 * @category type ids
 */
export type WritableTypeId = typeof WritableTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface Writable<R, W> extends Rx<R> {
  readonly [WritableTypeId]: WritableTypeId
  readonly write: (get: Rx.Get, set: Rx.Set, setSelf: (_: R) => void, refreshSelf: () => void, value: W) => void
}

/**
 * @since 1.0.0
 * @category context
 */
export interface Context {
  readonly get: Rx.Get
  readonly getResult: Rx.GetResult
  readonly once: Rx.Get
  readonly addFinalizer: (f: () => void) => void
  readonly refresh: Rx.RefreshRx
  readonly refreshSelf: () => void
  readonly self: <A>() => Option.Option<A>
  readonly setSelf: <A>(a: A) => void
  readonly set: Rx.Set
  readonly subscribe: <A>(rx: Rx<A>, f: (_: A) => void, options?: {
    readonly immediate?: boolean
  }) => void
}

const RxProto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },

  toJSON(this: Rx<any>) {
    return {
      _id: "Rx",
      keepAlive: this.keepAlive,
      label: this.label
    }
  },
  toString() {
    return Inspectable.toString(this)
  },
  [Inspectable.NodeInspectSymbol](this: Rx<any>) {
    return this.toJSON()
  }
} as const

const WritableProto = {
  ...RxProto,
  [WritableTypeId]: WritableTypeId
} as const

function defaultRefresh(this: Rx<any>, f: any) {
  f(this)
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const readable = <A>(
  read: Rx.Read<A>,
  refresh: Rx.Refresh = defaultRefresh
): Rx<A> => {
  const rx = Object.create(RxProto)
  rx.keepAlive = false
  rx.read = read
  rx.refresh = refresh
  return rx
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const writable = <R, W>(
  read: Rx.Read<R>,
  write: Rx.Write<R, W>,
  refresh: Rx.Refresh = defaultRefresh
): Writable<R, W> => {
  const rx = Object.create(WritableProto)
  rx.keepAlive = false
  rx.read = read
  rx.write = write
  rx.refresh = refresh
  return rx
}

function constSetSelf<A>(_get: Rx.Get, _set: Rx.Set, setSelf: (_: A) => void, _refreshSelf: () => void, value: A) {
  setSelf(value)
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const state = <A>(
  initialValue: A
): Writable<A, A> =>
  writable(function(_get, _ctx) {
    return initialValue
  }, constSetSelf)

function makeEffect<E, A>(
  ctx: Context,
  effect: Effect.Effect<never, E, A>,
  runCallback = Effect.runCallback
): Result.Result<E, A> {
  const previous = ctx.self<Result.Result<E, A>>()

  const cancel = runCallback(
    effect,
    function(exit) {
      if (!Exit.isInterrupted(exit)) {
        ctx.setSelf(Result.fromExit(exit))
      }
    }
  )
  ctx.addFinalizer(cancel)

  if (previous._tag === "Some") {
    return Result.waitingFrom(previous)
  }
  return Result.waiting(Result.initial())
}

function makeEffectRuntime<R, E, A, RE>(
  ctx: Context,
  effect: Effect.Effect<R, E, A>,
  runtime: RxRuntime<RE, R>
): Result.Result<E, A> {
  const previous = ctx.self<Result.Result<E, A>>()
  const runtimeResult = ctx.get(runtime)

  if (runtimeResult._tag !== "Success") {
    if (runtimeResult._tag === "Waiting") {
      return Result.waitingFrom(previous)
    }
    return runtimeResult as any
  }

  return makeEffect(ctx, effect as any, Runtime.runCallback(runtimeResult.value))
}

function makeScoped<R, E, A, RE>(
  ctx: Context,
  effect: Effect.Effect<R, E, A>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) {
  const scope = Effect.runSync(Scope.make())
  ctx.addFinalizer(() => Effect.runFork(Scope.close(scope, Exit.unit)))
  const scopedEffect = Effect.provideService(
    effect,
    Scope.Scope,
    scope
  )
  return options?.runtime
    ? makeEffectRuntime(ctx, scopedEffect, options.runtime)
    : makeEffect(ctx, scopedEffect as Effect.Effect<never, E, A>)
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const effect: {
  <E, A>(create: Rx.Read<Effect.Effect<never, E, A>>): Rx<Result.Result<E, A>>
  <RR, R extends RR, E, A, RE>(
    create: Rx.Read<Effect.Effect<R, E, A>>,
    options: { readonly runtime: RxRuntime<RE, RR> }
  ): Rx<Result.Result<RE | E, A>>
} = <R, E, A, RE>(
  create: Rx.Read<Effect.Effect<R, E, A>>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) =>
  readable<Result.Result<E, A>>(function(get, ctx) {
    const effect = create(get, ctx)
    return options?.runtime
      ? makeEffectRuntime(ctx, effect, options.runtime)
      : makeEffect(ctx, effect as Effect.Effect<never, E, A>)
  })

/**
 * @since 1.0.0
 * @category constructors
 */
export const scoped: {
  <E, A>(create: Rx.Read<Effect.Effect<Scope.Scope, E, A>>): Rx<Result.Result<E, A>>
  <RR, R extends (RR | Scope.Scope), E, A, RE>(
    create: Rx.Read<Effect.Effect<R, E, A>>,
    options: { readonly runtime: RxRuntime<RE, RR> }
  ): Rx<Result.Result<RE | E, A>>
} = <R, E, A, RE>(
  create: Rx.Read<Effect.Effect<R, E, A>>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) =>
  readable<Result.Result<E, A>>(function(get, ctx) {
    return makeScoped(ctx, create(get, ctx), options)
  })

/**
 * @since 1.0.0
 * @category models
 */
export interface RxResultFn<E, A, Arg> extends Writable<Result.Result<E, A>, Arg> {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const effectFn: {
  <Arg, E, A>(fn: Rx.ReadFn<Arg, Effect.Effect<never, E, A>>): RxResultFn<E, A, Arg>
  <Arg, RR, R extends RR, E, A, RE>(
    fn: Rx.ReadFn<Arg, Effect.Effect<R, E, A>>,
    options: { readonly runtime: RxRuntime<RE, RR> }
  ): RxResultFn<RE | E, A, Arg>
} = <Arg, R, E, A, RE>(
  f: Rx.ReadFn<Arg, Effect.Effect<R, E, A>>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) => {
  const argRx = state<[number, Arg]>([0, undefined as any])
  const effectRx = readable<Effect.Effect<R, E, A> | undefined>(function(get, ctx) {
    const [counter, arg] = get(argRx)
    if (counter === 0) {
      return undefined
    }
    return f(arg, get, ctx)
  })
  return writable<Result.Result<E, A>, Arg>(function(get, ctx) {
    const effect = get(effectRx)
    if (effect === undefined) {
      return Result.initial()
    }
    return options?.runtime
      ? makeEffectRuntime(ctx, effect, options.runtime)
      : makeEffect(ctx, effect as Effect.Effect<never, E, A>)
  }, function(get, set, _setSelf, _refreshSelf, arg) {
    set(argRx, [get(argRx)[0] + 1, arg])
  })
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const scopedFn: {
  <Arg, E, A>(fn: (arg: Arg, get: Rx.Get, ctx: Context) => Effect.Effect<Scope.Scope, E, A>): RxResultFn<E, A, Arg>
  <Arg, RR, R extends (RR | Scope.Scope), E, A, RE>(
    fn: (arg: Arg, get: Rx.Get, ctx: Context) => Effect.Effect<R, E, A>,
    options: { readonly runtime: RxRuntime<RE, RR> }
  ): RxResultFn<RE | E, A, Arg>
} = <Arg, R, E, A, RE>(
  f: (arg: Arg, get: Rx.Get, ctx: Context) => Effect.Effect<R, E, A>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) => {
  const argRx = state<[number, Arg]>([0, undefined as any])
  const effectRx = readable<Effect.Effect<R, E, A> | undefined>(function(get, ctx) {
    const [counter, arg] = get(argRx)
    if (counter === 0) {
      return undefined
    }
    return f(arg, get, ctx)
  })
  return writable<Result.Result<E, A>, Arg>(function(get, ctx) {
    const effect = get(effectRx)
    if (effect === undefined) {
      return Result.initial()
    }
    return makeScoped(ctx, effect, options)
  }, function(get, set, _setSelf, _refreshSelf, arg) {
    set(argRx, [get(argRx)[0] + 1, arg])
  })
}

/**
 * @since 1.0.0
 * @category models
 */
export interface RxRuntime<E, A> extends Rx<Result.Result<E, Runtime.Runtime<A>>> {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const runtime: {
  <E, A>(layer: Layer.Layer<never, E, A>): RxRuntime<E, A>
  <R, E, A, RR extends R, RE>(layer: Layer.Layer<R, E, A>, runtime: RxRuntime<RE, RR>): RxRuntime<E, A | RR>
} = <R, E, A, RE>(layer: Layer.Layer<R, E, A>, runtime?: RxRuntime<RE, R>): RxRuntime<E | RE, A> => {
  if (runtime === undefined) {
    return scoped(() => Layer.toRuntime(layer) as any)
  }

  return scoped(() =>
    Effect.flatMap(
      Layer.build(layer),
      (context) => Effect.provideSomeContext(Effect.runtime<A>(), context)
    ), { runtime })
}

function makeStream<E, A>(
  ctx: Context,
  stream: Stream.Stream<never, E, A>,
  runCallback = Effect.runCallback
): Result.Result<E | NoSuchElementException, A> {
  const previous = ctx.self<Result.Result<E | NoSuchElementException, A>>()

  const cancel = runCallback(
    Stream.runForEach(
      stream,
      (a) => Effect.sync(() => ctx.setSelf(Result.waiting(Result.success(a))))
    ),
    (exit) => {
      if (exit._tag === "Failure") {
        if (!Exit.isInterrupted(exit)) {
          ctx.setSelf(Result.failure(exit.cause))
        }
      } else {
        pipe(
          ctx.self<Result.Result<E | NoSuchElementException, A>>(),
          Option.flatMap(Result.value),
          Option.match({
            onNone: () => ctx.setSelf(Result.fail(NoSuchElementException())),
            onSome: (a) => ctx.setSelf(Result.success(a))
          })
        )
      }
    }
  )
  ctx.addFinalizer(cancel)

  if (previous._tag === "Some") {
    return Result.waitingFrom(previous)
  }
  return Result.waiting(Result.initial())
}

function makeStreamRuntime<R, E, A, RE>(
  ctx: Context,
  stream: Stream.Stream<R, E, A>,
  runtime: RxRuntime<RE, R>
): Result.Result<E | NoSuchElementException, A> {
  const previous = ctx.self<Result.Result<E | NoSuchElementException, A>>()
  const runtimeResult = ctx.get(runtime)

  if (runtimeResult._tag !== "Success") {
    if (runtimeResult._tag === "Waiting") {
      return Result.waitingFrom(previous)
    }
    return runtimeResult as any
  }

  return makeStream(ctx, stream as any, Runtime.runCallback(runtimeResult.value))
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const stream: {
  <E, A>(
    create: Rx.Read<Stream.Stream<never, E, A>>
  ): Rx<Result.Result<E | NoSuchElementException, A>>
  <RR, R extends RR, E, A, RE>(
    create: Rx.Read<Stream.Stream<R, E, A>>,
    options: { readonly runtime: RxRuntime<RE, RR> }
  ): Rx<Result.Result<RE | E | NoSuchElementException, A>>
} = <R, E, A, RE>(
  create: Rx.Read<Stream.Stream<R, E, A>>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) =>
  readable<Result.Result<E | NoSuchElementException, A>>(function(get, ctx) {
    const stream = create(get, ctx)
    return options?.runtime
      ? makeStreamRuntime(ctx, stream, options.runtime)
      : makeStream(ctx, stream as Stream.Stream<never, E, A>)
  })

/**
 * @since 1.0.0
 * @category constructors
 */
export const streamFn: {
  <Arg, E, A>(fn: Rx.ReadFn<Arg, Stream.Stream<never, E, A>>): RxResultFn<E | NoSuchElementException, A, Arg>
  <Arg, RR, R extends RR, E, A, RE>(
    fn: Rx.ReadFn<Arg, Stream.Stream<R, E, A>>,
    options: { readonly runtime: RxRuntime<RE, RR> }
  ): RxResultFn<RE | E | NoSuchElementException, A, Arg>
} = <Arg, R, E, A, RE>(
  f: Rx.ReadFn<Arg, Stream.Stream<R, E, A>>,
  options?: { readonly runtime?: RxRuntime<RE, R> }
) => {
  const argRx = state<[number, Arg]>([0, undefined as any])
  const streamRx = readable<Stream.Stream<R, E, A> | undefined>(function(get, ctx) {
    const [counter, arg] = get(argRx)
    if (counter === 0) {
      return undefined
    }
    return f(arg, get, ctx)
  })
  return writable<Result.Result<E | NoSuchElementException, A>, Arg>(function(get, ctx) {
    const stream = get(streamRx)
    if (stream === undefined) {
      return Result.initial()
    }
    return options?.runtime
      ? makeStreamRuntime(ctx, stream, options.runtime)
      : makeStream(ctx, stream as Stream.Stream<never, E, A>)
  }, function(get, set, _setSelf, _refreshSelf, arg) {
    set(argRx, [get(argRx)[0] + 1, arg])
  })
}
/**
 * @since 1.0.0
 * @category models
 */
export type StreamPullResult<E, A> = Result.Result<E | NoSuchElementException, {
  readonly done: boolean
  readonly items: Array<A>
}>

/**
 * @since 1.0.0
 * @category constructors
 */
export const streamPull: {
  <E, A>(create: Rx.Read<Stream.Stream<never, E, A>>, options?: {
    readonly disableAccumulation?: boolean
  }): Writable<StreamPullResult<E, A>, void>
  <RR, R extends RR, E, A, RE>(
    create: Rx.Read<Stream.Stream<R, E, A>>,
    options: {
      readonly runtime: RxRuntime<RE, RR>
      readonly disableAccumulation?: boolean
    }
  ): Writable<StreamPullResult<RE | E, A>, void>
} = <R, E, A>(
  create: Rx.Read<Stream.Stream<R, E, A>>,
  options?: {
    readonly runtime?: RxRuntime<unknown, R>
    readonly disableAccumulation?: boolean
  }
) => {
  const pullRx = scoped((get, ctx) => {
    const stream = create(get, ctx)
    return Stream.toPull(
      options?.disableAccumulation ? stream : pipe(
        Stream.chunks(stream),
        Stream.mapAccum(Chunk.empty<A>(), (acc, chunk) => {
          const next = Chunk.appendAll(acc, chunk)
          return [next, next]
        }),
        Stream.mapChunks(Chunk.flatten)
      )
    )
  }, options?.runtime as any)

  return writable<StreamPullResult<E, A>, void>(function(get, ctx) {
    const previous = ctx.self<Result.Result<E, A>>()
    const pullResult = get(pullRx)
    if (pullResult._tag !== "Success") {
      if (pullResult._tag === "Waiting") {
        return Result.waitingFrom(previous)
      }
      return pullResult as any
    }
    const pull = pipe(
      pullResult.value,
      Effect.map((_) => ({
        done: false,
        items: Chunk.toReadonlyArray(_) as Array<A>
      })),
      Effect.catchAll((error): Effect.Effect<never, E | NoSuchElementException, {
        readonly done: boolean
        readonly items: Array<A>
      }> =>
        Option.match(error, {
          onNone: () =>
            pipe(
              ctx.self<StreamPullResult<E, A>>(),
              Option.flatMap(Result.value),
              Option.match({
                onNone: () => Effect.fail(NoSuchElementException()),
                onSome: ({ items }) =>
                  Effect.succeed({
                    done: true,
                    items
                  })
              })
            ),
          onSome: Effect.fail
        })
      )
    )
    return options?.runtime
      ? makeEffectRuntime(ctx, pull, options.runtime)
      : makeEffect(ctx, pull as any)
  }, function(_get, _set, _setSelf, refreshSelf, _) {
    refreshSelf()
  }, function(refresh) {
    refresh(pullRx)
  })
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const family = <Arg, T extends Rx<any>>(
  f: (arg: Arg) => T
): (arg: Arg) => T => {
  const atoms = new Map<number, WeakRef<T>>()
  const registry = new FinalizationRegistry<number>((hash) => {
    atoms.delete(hash)
  })
  return function(arg) {
    const hash = Hash.hash(arg)
    const atom = atoms.get(hash)?.deref()
    if (atom !== undefined) {
      return atom
    }
    const newAtom = f(arg)
    atoms.set(hash, new WeakRef(newAtom))
    registry.register(newAtom, hash)
    return newAtom
  }
}

/**
 * @since 1.0.0
 * @category combinators
 */
export const keepAlive = <A extends Rx<any>>(self: A): A =>
  Object.assign(Object.create(Object.getPrototypeOf(self)), {
    ...self,
    keepAlive: true
  })

/**
 * @since 1.0.0
 * @category combinators
 */
export const refreshable = <T extends Rx<any>>(
  self: T
): T & Refreshable =>
  Object.assign(Object.create(Object.getPrototypeOf(self)), {
    ...self,
    [RefreshableTypeId]: RefreshableTypeId
  })

/**
 * @since 1.0.0
 * @category combinators
 */
export const withLabel = dual<
  (name: string) => <A extends Rx<any>>(self: A) => A,
  <A extends Rx<any>>(self: A, name: string) => <A extends Rx<any>>(self: A) => A
>(2, (self, name) =>
  Object.assign(Object.create(Object.getPrototypeOf(self)), {
    ...self,
    label: [name, new Error().stack?.split("\n")[5] ?? ""]
  }))

/**
 * @since 1.0.0
 */
export const batch: (f: () => void) => void = internalRegistry.batch
