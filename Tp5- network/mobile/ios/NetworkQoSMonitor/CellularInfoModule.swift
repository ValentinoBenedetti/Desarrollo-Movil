import Foundation
import CoreTelephony
import React

@objc(CellularInfoModule)
class CellularInfoModule: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(getCellularInfo:rejecter:)
  func getCellularInfo(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let networkInfo = CTTelephonyNetworkInfo()
    var carrierName = "Desconocido"
    var radioType = "Desconocido"
    var generation = "UNKNOWN"

    // 1. Operador celular
    if #available(iOS 12.0, *) {
      if let providers = networkInfo.serviceSubscriberCellularProviders {
        for (_, carrier) in providers {
          if let name = carrier.carrierName, !name.isEmpty {
            carrierName = name
            break
          }
        }
      }
    } else {
      if let carrier = networkInfo.subscriberCellularProvider, let name = carrier.carrierName {
        carrierName = name
      }
    }

    // 2. Tecnología celular y generación
    if #available(iOS 12.0, *) {
      if let currentRadioTech = networkInfo.serviceCurrentRadioAccessTechnology {
        for (_, tech) in currentRadioTech {
          (radioType, generation) = self.mapRadioTechnology(tech)
          break
        }
      }
    } else {
      if let currentRadio = networkInfo.currentRadioAccessTechnology {
        (radioType, generation) = self.mapRadioTechnology(currentRadio)
      }
    }

    // 3. Nivel de señal: En iOS público no existe API permitida por Apple para dBm celular crudo.
    // Retornamos null y señal registral estándar.
    let result: [String: Any?] = [
      "carrier": carrierName,
      "radioType": radioType,
      "generation": generation,
      "signalStrengthDbm": nil,
      "signalLevel": 3,
      "isRegistered": carrierName != "Desconocido"
    ]

    resolve(result)
  }

  private func mapRadioTechnology(_ tech: String) -> (String, String) {
    if #available(iOS 14.1, *) {
      if tech == CTRadioAccessTechnologyNR || tech == CTRadioAccessTechnologyNRNSA {
        return ("NR (5G)", "5G")
      }
    }

    switch tech {
    case CTRadioAccessTechnologyLTE:
      return ("LTE", "4G")
    case CTRadioAccessTechnologyWCDMA,
         CTRadioAccessTechnologyHSDPA,
         CTRadioAccessTechnologyHSUPA:
      return ("3G", "3G")
    case CTRadioAccessTechnologyEdge:
      return ("EDGE", "2G")
    case CTRadioAccessTechnologyGPRS:
      return ("GPRS", "2G")
    default:
      return ("Desconocido", "UNKNOWN")
    }
  }
}
