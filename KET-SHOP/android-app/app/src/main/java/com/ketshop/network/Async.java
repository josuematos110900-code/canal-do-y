package com.ketshop.network;

import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Executa tarefas de rede fora da thread principal e devolve o resultado
 * na thread de UI (substitui AsyncTask/coroutines sem dependências).
 */
public final class Async {

    public interface Task<T> { T run() throws Exception; }
    public interface OnSuccess<T> { void accept(T value); }
    public interface OnError { void accept(ApiException error); }

    private static final ExecutorService POOL = Executors.newFixedThreadPool(4);
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private Async() { }

    public static <T> void run(final Task<T> task, final OnSuccess<T> onSuccess, final OnError onError) {
        POOL.execute(() -> {
            try {
                final T result = task.run();
                MAIN.post(() -> { if (onSuccess != null) onSuccess.accept(result); });
            } catch (ApiException e) {
                MAIN.post(() -> { if (onError != null) onError.accept(e); });
            } catch (Exception e) {
                final ApiException wrapped = new ApiException(ApiException.PARSE, "UNEXPECTED",
                        "Ocorreu um erro inesperado: " + e.getClass().getSimpleName());
                MAIN.post(() -> { if (onError != null) onError.accept(wrapped); });
            }
        });
    }

    public static void main(Runnable r) { MAIN.post(r); }

    public static void mainDelayed(Runnable r, long delayMs) { MAIN.postDelayed(r, delayMs); }

    public static void cancel(Runnable r) { MAIN.removeCallbacks(r); }
}
