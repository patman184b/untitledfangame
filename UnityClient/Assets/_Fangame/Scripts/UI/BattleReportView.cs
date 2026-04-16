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
    /// UI for viewing detailed battle reports.
    /// Shows casualties for both sides and round-by-round summary.
    /// </summary>
    public class BattleReportView : MonoBehaviour
    {
        [Header("UI References")]
        public GameObject panelRoot;
        public TextMeshProUGUI titleText;
        public TextMeshProUGUI resultText;
        public TextMeshProUGUI casualtyText;
        public Transform roundsContainer;
        public GameObject roundRowPrefab;

        public void Open(string reportId)
        {
            panelRoot.SetActive(true);
            LoadReport(reportId);
        }

        private void LoadReport(string reportId)
        {
            StartCoroutine(GameSession.Instance.Get($"/api/battle-report/{reportId}", (json, err) => {
                if (err != null) return;
                var report = JsonConvert.DeserializeObject<FullBattleReportDto>(json);
                UpdateUI(report);
            }));
        }

        private void UpdateUI(FullBattleReportDto report)
        {
            titleText.text = $"Battle Report: {report.attacker_id} vs {report.defender_id}";
            resultText.text = report.result.ToUpper();
            resultText.color = report.winner_id == GameSession.Instance.PlayerId ? Color.green : Color.red;

            // Casualties
            var cas = JsonConvert.DeserializeObject<CasualtiesDto>(report.casualties_json);
            string s = "Losses:\n";
            foreach(var kv in cas.attacker) s += $"Attacker {kv.Key}: -{kv.Value}\n";
            foreach(var kv in cas.defender) s += $"Defender {kv.Key}: -{kv.Value}\n";
            casualtyText.text = s;

            // Rounds
            foreach (Transform t in roundsContainer) Destroy(t.gameObject);
            var rounds = JsonConvert.DeserializeObject<List<BattleRoundDto>>(report.rounds_json);
            foreach (var r in rounds)
            {
                var row = Instantiate(roundRowPrefab, roundsContainer);
                row.GetComponentInChildren<TextMeshProUGUI>().text = $"Round {r.round}: {r.action}";
            }
        }

        public void Close() => panelRoot.SetActive(false);
    }

    [Serializable]
    public class FullBattleReportDto
    {
        public string id, attacker_id, defender_id, winner_id, result;
        public string casualties_json, rounds_json;
    }

    [Serializable]
    public class CasualtiesDto
    {
        public Dictionary<string, int> attacker;
        public Dictionary<string, int> defender;
    }

    [Serializable]
    public class BattleRoundDto { public int round; public string action; }
}
