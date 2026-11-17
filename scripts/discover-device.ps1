$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime] | Out-Null
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime] | Out-Null
$core8Profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if ($null -eq $core8Profile) { throw 'No active connection profile is available.' }
$core8Manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($core8Profile)
$core8Candidates = @()
if ($core8Manager.TetheringOperationalState.ToString() -eq 'On') {
    foreach ($core8Client in $core8Manager.GetTetheringClients()) {
        $core8Names = @($core8Client.HostNames | ForEach-Object { $_.CanonicalName })
        if (@($core8Names | Where-Object { $_ -match '^(esp32[-.]|core8)' }).Count -gt 0) {
            foreach ($core8Name in $core8Names) {
                if ($core8Name -match '^\d{1,3}(\.\d{1,3}){3}$') { $core8Candidates += $core8Name }
            }
        }
    }
}
[pscustomobject]@{
    state = $core8Manager.TetheringOperationalState.ToString()
    ssid = $core8Manager.GetCurrentAccessPointConfiguration().Ssid
    candidates = @($core8Candidates | Select-Object -Unique)
} | ConvertTo-Json -Depth 3 -Compress
