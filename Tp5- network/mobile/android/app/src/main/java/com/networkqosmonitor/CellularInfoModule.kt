package com.networkqosmonitor

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.*
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CellularInfoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CellularInfoModule"

    @ReactMethod
    fun getCellularInfo(promise: Promise) {
        try {
            val telephonyManager =
                reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

            if (telephonyManager == null) {
                promise.reject("TELEPHONY_UNAVAILABLE", "TelephonyManager no está disponible en este dispositivo.")
                return
            }

            val hasFineLocation = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            val hasPhoneState = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.READ_PHONE_STATE
            ) == PackageManager.PERMISSION_GRANTED

            val resultMap = Arguments.createMap()

            // 1. Operador
            val carrierName = telephonyManager.networkOperatorName.takeIf { it.isNotBlank() }
                ?: telephonyManager.simOperatorName.takeIf { it.isNotBlank() }
                ?: "Desconocido"
            resultMap.putString("carrier", carrierName)

            // 2. Tipo de red de datos
            val dataNetworkType = if (hasPhoneState) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    telephonyManager.dataNetworkType
                } else {
                    @Suppress("DEPRECATION")
                    telephonyManager.networkType
                }
            } else {
                TelephonyManager.NETWORK_TYPE_UNKNOWN
            }

            val (radioType, generation) = mapNetworkType(dataNetworkType)
            resultMap.putString("radioType", radioType)
            resultMap.putString("generation", generation)

            // 3. Nivel de señal y RSSI / RSRP
            var signalDbm: Int? = null
            var signalLevel = 0
            var isRegistered = false

            if (hasFineLocation) {
                try {
                    val cellInfos = telephonyManager.allCellInfo
                    if (!cellInfos.isNullOrEmpty()) {
                        for (info in cellInfos) {
                            if (info.isRegistered) {
                                isRegistered = true
                                when (info) {
                                    is CellInfoLte -> {
                                        signalDbm = info.cellSignalStrength.dbm
                                        signalLevel = info.cellSignalStrength.level
                                    }
                                    is CellInfoWcdma -> {
                                        signalDbm = info.cellSignalStrength.dbm
                                        signalLevel = info.cellSignalStrength.level
                                    }
                                    is CellInfoGsm -> {
                                        signalDbm = info.cellSignalStrength.dbm
                                        signalLevel = info.cellSignalStrength.level
                                    }
                                    else -> {
                                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && info is CellInfoNr) {
                                            signalDbm = (info.cellSignalStrength as? CellSignalStrengthNr)?.dbm
                                            signalLevel = info.cellSignalStrength.level
                                        }
                                    }
                                }
                                break
                            }
                        }
                    }
                } catch (e: SecurityException) {
                    // Fallback silencioso si el usuario revocó el permiso dinámico
                }
            }

            // Fallback para nivel de señal general en Android 9+ si no se pudo leer CellInfo
            if (signalDbm == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                telephonyManager.signalStrength?.let { ss ->
                    signalLevel = ss.level
                }
            }

            if (signalDbm != null) {
                resultMap.putInt("signalStrengthDbm", signalDbm)
            } else {
                resultMap.putNull("signalStrengthDbm")
            }

            resultMap.putInt("signalLevel", signalLevel)
            resultMap.putBoolean("isRegistered", isRegistered)

            promise.resolve(resultMap)
        } catch (e: Exception) {
            promise.reject("CELLULAR_INFO_ERROR", "Error al consultar información celular: ${e.message}", e)
        }
    }

    private fun mapNetworkType(type: Int): Pair<String, String> {
        return when (type) {
            TelephonyManager.NETWORK_TYPE_NR -> Pair("NR (5G)", "5G")
            TelephonyManager.NETWORK_TYPE_LTE -> Pair("LTE", "4G")
            TelephonyManager.NETWORK_TYPE_HSPAP -> Pair("HSPA+", "3G")
            TelephonyManager.NETWORK_TYPE_HSPA -> Pair("HSPA", "3G")
            TelephonyManager.NETWORK_TYPE_HSDPA -> Pair("HSDPA", "3G")
            TelephonyManager.NETWORK_TYPE_HSUPA -> Pair("HSUPA", "3G")
            TelephonyManager.NETWORK_TYPE_UMTS -> Pair("UMTS", "3G")
            TelephonyManager.NETWORK_TYPE_EDGE -> Pair("EDGE", "2G")
            TelephonyManager.NETWORK_TYPE_GPRS -> Pair("GPRS", "2G")
            TelephonyManager.NETWORK_TYPE_CDMA -> Pair("CDMA", "2G")
            TelephonyManager.NETWORK_TYPE_1xRTT -> Pair("1xRTT", "2G")
            else -> Pair("Desconocido", "UNKNOWN")
        }
    }
}
