/* 일부 브라우저는 클릭 직후 주소를 풀면 다운로드가 시작되기 전에 실패해서 잠시 뒤에 풉니다 */
const REVOKE_DELAY_MS = 1000;

/* 받은 파일(Blob)을 브라우저 다운로드로 저장합니다 */
export function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
