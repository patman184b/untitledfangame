using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Networking;

namespace Fangame.Networking
{
    public class ShardApiClient
    {
        private string _baseUrl;

        public ShardApiClient(string baseUrl)
        {
            _baseUrl = baseUrl.TrimEnd('/');
        }

        public async Task<ShardDto> GetShardAsync()
        {
            using var req = UnityWebRequest.Get($"{_baseUrl}/api/shard");
            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            
            if (req.result != UnityWebRequest.Result.Success)
                throw new Exception(req.error);

            return JsonConvert.DeserializeObject<ShardDto>(req.downloadHandler.text);
        }

        public async Task<List<UnitDto>> GetUnitsAsync()
        {
            using var req = UnityWebRequest.Get($"{_baseUrl}/api/units");
            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            return JsonConvert.DeserializeObject<List<UnitDto>>(req.downloadHandler.text);
        }

        public async Task RecruitAsync(string playerId, string unitId, int count)
        {
            var data = new { playerId, unitId, count };
            string json = JsonConvert.SerializeObject(data);
            using var req = new UnityWebRequest($"{_baseUrl}/api/recruit", "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");

            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            if (req.result != UnityWebRequest.Result.Success) throw new Exception(req.error);
        }

        public async Task UpdateFormationAsync(string commanderId, string playerId, List<FormationSlotDto> slots)
        {
            var data = new { commanderId, playerId, slots };
            string json = JsonConvert.SerializeObject(data);
            using var req = new UnityWebRequest($"{_baseUrl}/api/formation/update", "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");

            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            if (req.result != UnityWebRequest.Result.Success) throw new Exception(req.error);
        }

        public async Task<List<InventoryItemDto>> GetInventoryAsync(string playerId)
        {
            using var req = UnityWebRequest.Get($"{_baseUrl}/api/inventory/{playerId}");
            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            return JsonConvert.DeserializeObject<List<InventoryItemDto>>(req.downloadHandler.text);
        }
    }

    [Serializable]
    public class UnitDto
    {
        public string id;
        public string name;
        public string faction;
        public string type;
        public UnitCostDto cost;
        public int trainingTime;
    }

    [Serializable]
    public class UnitCostDto
    {
        public int grain;
        public int wood;
        public int ore;
        public int gold;
    }

    [Serializable]
    public class InventoryItemDto
    {
        public string unit_id;
        public int count;
    }

        public async Task<List<BattleReportDto>> GetBattleHistoryAsync(string playerId)
        {
            using var req = UnityWebRequest.Get($"{_baseUrl}/api/battle-history/{playerId}");
            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            if (req.result != UnityWebRequest.Result.Success) throw new Exception(req.error);
            return JsonConvert.DeserializeObject<List<BattleReportDto>>(req.downloadHandler.text);
        }

        public async Task<BattleReportDto> GetBattleReportAsync(string reportId)
        {
            using var req = UnityWebRequest.Get($"{_baseUrl}/api/battle-report/{reportId}");
            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            if (req.result != UnityWebRequest.Result.Success) throw new Exception(req.error);
            return JsonConvert.DeserializeObject<BattleReportDto>(req.downloadHandler.text);
        }
    }

    [Serializable]
    public class BattleReportDto
    {
        public string id;
        public string attacker_id;
        public string defender_id;
        public string winner_id;
        public string casualties_json;
        public string rounds_json;
        public long created_at;
    }

    [Serializable]
    public class ShardDto
    {
        public int id;
        public string status;
        public int tick;
        public int season_day;
        public List<TileDto> tiles;
    }

    [Serializable]
    public class TileDto
    {
        public int X; // Q
        public int Y; // R
        public string Terrain;
        public string OwnerId;
        public string RegionId;
        public string StructureId;
        public bool IsAnchor;
        public int Level;
        public int SiegeHP;
        public int MaxSiegeHP;
    }
}
