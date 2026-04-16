using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using Fangame.Networking;
using TMPro;
using Newtonsoft.Json;

namespace Fangame.UI
{
    public class BattleReportWindow : MonoBehaviour
    {
        [Header("Tabs")]
        public GameObject summaryPanel;
        public GameObject historyPanel;

        [Header("Summary View")]
        public TextMeshProUGUI titleText;
        public TextMeshProUGUI casualtyText;
        public TextMeshProUGUI logText;

        [Header("History View")]
        public Transform historyListContent;
        public GameObject historyItemPrefab;

        private ShardApiClient _api;
        private string _playerId = "player_1";

        public void Open(ShardApiClient api)
        {
            _api = api;
            gameObject.SetActive(true);
            ShowSummaryTab();
        }

        public async void ShowHistoryTab()
        {
            summaryPanel.SetActive(false);
            historyPanel.SetActive(true);

            // Clean list
            foreach (Transform child in historyListContent) Destroy(child.gameObject);

            var reports = await _api.GetBattleHistoryAsync(_playerId);
            foreach (var r in reports)
            {
                var item = Instantiate(historyItemPrefab, historyListContent).GetComponent<Button>();
                item.GetComponentInChildren<TextMeshProUGUI>().text = $"Battle {r.id} ({r.created_at})";
                item.onClick.AddListener(() => LoadReport(r.id));
            }
        }

        public void ShowSummaryTab()
        {
            summaryPanel.SetActive(true);
            historyPanel.SetActive(false);
        }

        public async void LoadReport(string reportId)
        {
            var report = await _api.GetBattleReportAsync(reportId);
            bool isWinner = report.winner_id == _playerId;
            
            titleText.text = isWinner ? "<color=green>VICTORY</color>" : "<color=red>DEFEAT</color>";
            casualtyText.text = $"Casualties: {report.casualties_json}";
            logText.text = $"Battle Log:\n{report.rounds_json}";
            
            ShowSummaryTab();
        }
    }
}
