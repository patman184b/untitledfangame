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
    /// UI for alliance members list, contribution ranking, and merit.
    /// </summary>
    public class AlliancePanel : MonoBehaviour
    {
        [Header("UI References")]
        public GameObject panelRoot;
        public TextMeshProUGUI allianceNameText;
        public Transform memberContainer;
        public GameObject memberRowPrefab;

        public void Open()
        {
            panelRoot.SetActive(true);
            LoadAllianceData();
        }

        private void LoadAllianceData()
        {
            StartCoroutine(GameSession.Instance.Get("/api/alliance/my", (json, err) => {
                if (err != null) return;
                var data = JsonConvert.DeserializeObject<AllianceDto>(json);
                allianceNameText.text = data.name;
                RefreshMembers(data.members);
            }));
        }

        private void RefreshMembers(List<AllianceMemberDto> members)
        {
            foreach (Transform t in memberContainer) Destroy(t.gameObject);
            foreach (var m in members)
            {
                var row = Instantiate(memberRowPrefab, memberContainer);
                var tmp = row.GetComponentInChildren<TextMeshProUGUI>();
                tmp.text = $"{m.player_id} | Merit: {m.merit} | Contrib: {m.contribution}";
            }
        }

        public void Close() => panelRoot.SetActive(false);
    }

    [Serializable]
    public class AllianceDto { 
        public string id, name; 
        public List<AllianceMemberDto> members; 
    }

    [Serializable]
    public class AllianceMemberDto { 
        public string player_id; 
        public int merit, contribution; 
    }
}
