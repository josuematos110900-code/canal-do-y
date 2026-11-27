# Elite Shop — regras ProGuard/R8 (apenas se activar minifyEnabled)
# Os modelos são Serializable e passados por Intent.
-keep class com.ketshop.models.** { *; }
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
