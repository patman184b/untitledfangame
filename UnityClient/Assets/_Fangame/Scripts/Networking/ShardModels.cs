using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Fangame.Networking
{
    [Serializable]
    public class ServerConfigDto
    {
        [JsonProperty("version")] public string Version;
        [JsonProperty("tickIntervalSec")] public float TickIntervalSec;
        [JsonProperty("seasonLengthDays")] public int SeasonLengthDays;
    }

    [Serializable]
    public class MetaDto
    {
        [JsonProperty("tick")] public int Tick;
        [JsonProperty("tickIntervalSec")] public float TickIntervalSec;
        [JsonProperty("seasonDay")] public int SeasonDay;
        [JsonProperty("seasonLengthDays")] public int SeasonLengthDays;
        [JsonProperty("startedAt")] public string StartedAt;
    }

    [Serializable]
    public class TileDto
    {
        [JsonProperty("x")] public int X;
        [JsonProperty("y")] public int Y;
        [JsonProperty("terrain")] public string Terrain;
        [JsonProperty("ownerId")] public string OwnerId;
        [JsonProperty("capitalName")] public string CapitalName;
    }

    [Serializable]
    public class PlayerDto
    {
        [JsonProperty("id")] public string Id;
        [JsonProperty("name")] public string Name;
        [JsonProperty("factionKey")] public string FactionKey;
        [JsonProperty("factionLabel")] public string FactionLabel;
        [JsonProperty("wood")] public int Wood;
        [JsonProperty("ore")] public int Ore;
        [JsonProperty("grain")] public int Grain;
    }

    [Serializable]
    public class ArmyDto
    {
        [JsonProperty("id")] public string Id;
        [JsonProperty("playerId")] public string PlayerId;
        [JsonProperty("x")] public int X;
        [JsonProperty("y")] public int Y;
        [JsonProperty("power")] public int Power;
    }

    [Serializable]
    public class ActionDto
    {
        [JsonProperty("id")] public string Id;
        [JsonProperty("type")] public string Type;
        [JsonProperty("playerId")] public string PlayerId;
        [JsonProperty("endTick")] public int EndTick;
    }

    [Serializable]
    public class WorldStateDto
    {
        [JsonProperty("meta")] public MetaDto Meta;
        [JsonProperty("width")] public int Width;
        [JsonProperty("height")] public int Height;
        [JsonProperty("tiles")] public List<TileDto> Tiles;
        [JsonProperty("players")] public List<PlayerDto> Players;
        [JsonProperty("armies")] public List<ArmyDto> Armies;
        [JsonProperty("actions")] public List<ActionDto> Actions;
    }

    [Serializable]
    public class WsEnvelope
    {
        [JsonProperty("type")] public string Type;
        [JsonProperty("data")] public WorldStateDto Data;
    }

    [Serializable]
    public class JoinResponseDto
    {
        [JsonProperty("playerId")] public string PlayerId;
        [JsonProperty("player")] public PlayerDto Player;
        [JsonProperty("error")] public string Error;
    }

    [Serializable]
    public class ErrorBodyDto
    {
        [JsonProperty("error")] public string Error;
    }
}
