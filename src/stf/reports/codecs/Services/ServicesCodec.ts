import { Codec } from "scale-ts";
import { ServiceItemCodec } from "./ServiceItemCodec";
import { DiscriminatorCodec } from "../../../../codecs";
import { ServiceItem } from "../../../types";

// Services is an array of ServiceItem
export const ServicesCodec: Codec<ServiceItem[]> =
  DiscriminatorCodec(ServiceItemCodec);
