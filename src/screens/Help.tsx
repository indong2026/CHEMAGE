import { Modal } from '../components/Modal';
export function Help({ onClose }: { onClose: () => void }) {
  return <Modal title="작은 마법 안내서" onClose={onClose}>
    <div className="help-block"><b>원소를 골라 바로 시전하세요</b><p>H + H + O = H₂O. 순서와 관계없이 정확한 원소를 고르면 마법이 완성됩니다. 선택은 자유롭게 바꿀 수 있고, 발동한 원소만 소모됩니다. 완성한 화학식은 도감에 남으며, 발견한 마법은 빠른 조합으로 선택할 수 있어요.</p></div>
    <div className="help-block"><b>한 턴에 마법 두 번</b><p>두 번째 마법을 쓰거나 턴 종료·방어를 누르면 적이 행동합니다. 방어는 남은 행동을 마치며 보호막을 만듭니다. H₂O 다음 NaCl, O₂ 다음 공격 마법을 시도해 보세요. 상태 아이콘과 효과 버튼으로 자세히 볼 수 있습니다.</p></div>
    <div className="help-block"><b>원소가 넘치면 마력이 됩니다</b><p>전투 시작에 5개, 다음 턴마다 3개. 가방 12칸을 넘는 새 원소는 하나당 마력 15가 됩니다. 기존 원소는 그대로 남아요. 마법을 쓸 때도 마력 10을 얻습니다.</p></div>
    <div className="help-block"><b>마력 100이면 ZERO BURST</b><p>버튼을 누르면 마력 100을 소모하고 방어력을 무시하는 피해 30! 적 보호막은 적용됩니다. 필살기 후 내 턴이 끝나며, 적을 쓰러뜨렸다면 적은 공격하지 않습니다.</p></div>
    <p className="fine-print">승리하면 체력 15 회복과 보상 하나. 마력과 강화는 다음 전투에도 남습니다. 새로고침하면 모험은 초기화되고, 도감만 저장됩니다.</p>
  </Modal>;
}
