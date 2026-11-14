import Button from "@/components/Button/Button";
import WorkspaceState from "@/components/Workspace/WorkspaceState";

export default function ProjectListEmpty({
  search,
  onClear,
  onCreate,
}: {
  search: string;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <WorkspaceState
      kind="empty"
      title={search ? `‘${search}’과 맞는 프로젝트가 없어요` : "아직 프로젝트가 없어요"}
      description={
        search
          ? "이름이나 URL을 다시 확인해 보세요"
          : "진단할 사이트를 등록하고 첫 테스트를 시작해 보세요"
      }
      action={
        search ? (
          <Button variant="secondary" icon="close" onClick={onClear}>
            검색어 지우기
          </Button>
        ) : (
          <Button variant="outline" icon="plus" onClick={onCreate}>
            새 프로젝트 만들기
          </Button>
        )
      }
    />
  );
}
