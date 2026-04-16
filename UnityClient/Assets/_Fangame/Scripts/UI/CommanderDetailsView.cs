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
    /// Detailed view for a single commander.
    /// Shows stats, skill tree, and respect level.
    /// </summary>
    public class CommanderDetailsView : MonoBehaviour
    {
        [Header("UI References")]
        public GameObject panelRoot;
        public TextMeshProUGUI nameText;
        public TextMeshProUGUI statsText; // Might: 100, Focus: 80, etc.
        public TextMeshProUGUI respectText;
        public TextMeshProUGUI pointsText; // Points: 2/10

        [Header("Skill List")]
        public Transform skillContainer;
        public GameObject skillRowPrefab;

        private string _commanderId;
        private CommanderDataDto _baseData;

        public void Open(string commanderId)
        {
            _commanderId = commanderId;
            panelRoot.SetActive(true);
            LoadData();
        }

        private void LoadData()
        {
            // 1. Get base static data from catalog
            StartCoroutine(GameSession.Instance.Get("/api/commanders", (json, err) => {
                if (err != null) return;
                var list = JsonConvert.DeserializeObject<List<CommanderDataDto>>(json);
                _baseData = list.Find(c => c.id == _commanderId);
                
                // 2. Get player-specific data
                StartCoroutine(GameSession.Instance.Get($"/api/commanders/{_commanderId}/details", (json2, err2) => {
                    if (err2 != null) return;
                    var detail = JsonConvert.DeserializeObject<CommanderDetailDto>(json2);
                    UpdateUI(_baseData, detail);
                }));
            }));
        }

        private void UpdateUI(CommanderDataDto baseData, CommanderDetailDto detail)
        {
            nameText.text = baseData.name;
            statsText.text = $"Might: {baseData.base_stats.might} | Focus: {baseData.base_stats.focus} | Speed: {baseData.base_stats.speed}";
            
            int respectLvl = (detail.respect?.respect_points ?? 0) / 1000;
            respectText.text = $"Respect Level: {respectLvl} ({detail.respect?.respect_points} pts)";

            int totalPoints = respectLvl * 2;
            int spent = 0;
            if (detail.skills != null) foreach (var s in detail.skills) spent += s.level;
            pointsText.text = $"Skill Points: {totalPoints - spent} / {totalPoints}";

            // Refresh Skill List
            foreach (Transform t in skillContainer) Destroy(t.gameObject);
            foreach (var skillDef in baseData.skills)
            {
                var row = Instantiate(skillRowPrefab, skillContainer);
                var rowScript = row.GetComponent<SkillRowItem>();
                
                int currentLevel = 0;
                var sData = detail.skills?.Find(s => s.skill_id == skillDef.id);
                if (sData != null) currentLevel = sData.level;

                rowScript.Setup(skillDef, currentLevel, () => OnUpgradeSkill(skillDef.id));
            }
        }

        private void OnUpgradeSkill(string skillId)
        {
            var payload = new { commanderId = _commanderId, skillId = skillId };
            string body = JsonConvert.SerializeObject(payload);

            StartCoroutine(GameSession.Instance.Post("/api/commanders/skills/upgrade", body, null, (json, err) => {
                if (err != null) { Debug.LogError("Upgrade failed: " + err); return; }
                LoadData(); // Simple refresh
            }));
        }

        public void Close() => panelRoot.SetActive(false);
    }

    [Serializable]
    public class CommanderDataDto
    {
        public string id;
        public string name;
        public BaseStatsDto base_stats;
        public List<SkillDefDto> skills;
    }

    [Serializable]
    public class BaseStatsDto { public int might, focus, speed, command; }

    [Serializable]
    public class SkillDefDto { public string id, name, effect; public int tier; }

    [Serializable]
    public class CommanderDetailDto
    {
        public RespectDto respect;
        public List<SkillLevelDto> skills;
    }

    [Serializable]
    public class RespectDto { public int respect_points; }
    
    [Serializable]
    public class SkillLevelDto { public string skill_id; public int level; }
}
