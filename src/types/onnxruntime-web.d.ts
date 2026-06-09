// ============================================================
// ONNX Runtime Web ESM 包装模块类型声明
// 解决 onnxruntime-web 在 ESM 模式下的类型导入问题
// ============================================================

declare module 'onnxruntime-web' {
  export * from 'onnxruntime-common';
}