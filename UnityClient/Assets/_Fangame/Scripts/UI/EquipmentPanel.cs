using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using Fangame.Networking;
using Newtonsoft.Json;
using System;

namespace Fangame.UI
{
    /// <summary>
    /// UI for managing a commander's equipment.
    /// Shows 4 slots: Weapon, Helmet, Armor, Accessory.
    /// Opens the Gear Inventory for swaps.
    /// </summary>
    public class EquipmentPanel : MonoBehaviour
    {
        [Header("Slot Icons")]
        public Image weaponIcon;
        public Image helmetIcon;
        public Image armorIcon;
        public Image accessoryIcon;

        [Header("Inventory Ref")]
        public GameObject gearInventoryPanel;
        public Transform gearInventoryContainer;
        public GameObject gearItemPrefab;

        private string _activeCommanderId;
        private string _activeSlot;

        public void Setup(string commanderId, List<EquippedGearDto> currentGear)
        {
            _activeCommanderId = commanderId;
            ClearSlots();
            foreach (var g in currentGear)
            {
                UpdateSlotIcon(g.slot, g.gear_id);
            }
        }

        private void ClearSlots()
        {
            weaponIcon.color = Color.gray;
            helmetIcon.color = Color.gray;
            armorIcon.color = Color.gray;
            accessoryIcon.color = Color.gray;
        }

        private void UpdateSlotIcon(string slot, string gearId)
        {
            // In a real app, load sprite based on gearId
            switch (slot)
            {
                case "weapon": weaponIcon.color = Color.white; break;
                case "helmet": helmetIcon.color = Color.white; break;
                case "armor": armorIcon.color = Color.white; break;
                case "accessory": accessoryIcon.color = Color.white; break;
            }
        }

        public void OnSlotClicked(string slot)
        {
            _activeSlot = slot;
            gearInventoryPanel.SetActive(true);
            LoadGearInventory();
        }

        private void LoadGearInventory()
        {
            StartCoroutine(GameSession.Instance.Get("/api/gear/inventory", (json, err) => {
                if (err != null) return;
                var inv = JsonConvert.DeserializeObject<List<GearInstanceDto>>(json);
                RefreshInventoryUI(inv);
            }));
        }

        private void RefreshInventoryUI(List<GearInstanceDto> inv)
        {
            foreach (Transform t in gearInventoryContainer) Destroy(t.gameObject);
            foreach (var gear in inv)
            {
                var card = Instantiate(gearItemPrefab, gearInventoryContainer);
                card.GetComponentInChildren<TextMeshProUGUI>().text = gear.gear_id;
                card.GetComponent<Button>().onClick.AddListener(() => OnEquipConfirm(gear.id));
            }
        }

        private void OnEquipConfirm(string instanceId)
        {
            var payload = new { commanderId = _activeCommanderId, gearInstanceId = instanceId, slot = _activeSlot };
            string body = JsonConvert.SerializeObject(payload);

            StartCoroutine(GameSession.Instance.Post("/api/gear/equip", body, null, (json, err) => {
                if (err != null) return;
                gearInventoryPanel.SetActive(false);
                // Refresh parent view
                SendMessageUpwards("LoadData");
            }));
        }
    }

    [Serializable]
    public class EquippedGearDto { public string slot, gear_id; }

    [Serializable]
    public class GearInstanceDto { public string id, gear_id; public int refine_level, strengthen_level; }
}
