import Logger from "./Logger.js";
import Rx from "rxjs";
/**
 *  Wrapper for Fetch API (https://developer.mozilla.org/en/docs/Web/API/Fetch_API)
 *  Inspired by Angular 1's $http service.
 *  Features: setup default headers, interceptors, retry (GET only) on error.
 *  Future note: Consider using service worker instead of this for more standard solution.
 *  Usage sample:
 *    const [data, status] = await fetchHelperInstance.fetch( *the same parameters as Fetch API* )
 */
class FetchHelper {
  static RETRY = true;
  static MAX_RETRY = 3;
  static RETRY_DELAY = 1000;

  FORM_URL_ENCODED = "application/x-www-form-urlencoded";

  constructor() {
    this.defaultHeaders = {
      "Content-Type": "application/json"
    };
    this.beforeRequestInterceptors = [];
    this.afterResponseInterceptors = [];
  }

  /**
     *  Add default header to each Fetch request.
     */
  addDefaultHeader(key, value) {
    this.defaultHeaders[key] = value;
  }
  /**
     *  Remove default header
     */
  removeDefaultHeader(key) {
    delete this.defaultHeaders[key];
  }
  /**
     *  To define something to do before every fetch request.
     *  Params:
     *      TBD
     *  Result:
     *      Returns a function to remove added interceptor.
     *  Future note: Consider using Service Worker
     */
  addBeforeRequestInterceptor(interceptor) {
    this.beforeRequestInterceptors.push(interceptor);
    return () => {
      const index = this.beforeRequestInterceptors.indexOf(interceptor);
      this.beforeRequestInterceptors.splice(index, 1);
    };
  }
  /**
     *  To define something to do after every fetch response.
     *  If one of interceptors returns false, the process will be stop immediately.
     *  Params:
     *      interceptor: function (response)
     *  Result:
     *      Returns a function to remove added interceptor.
     *  Future note: Consider using Service Worker
     */
  addAfterResonseInterceptor(interceptor) {
    this.afterResponseInterceptors.push(interceptor);
    return () => {
      const index = this.afterResponseInterceptors.indexOf(interceptor);
      this.afterResponseInterceptors.splice(index, 1);
    };
  }
  jsonToForm(json = {}) {
    return Object.keys(json)
      .map(key => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(json[key]);
      })
      .join("&");
  }
  jsonToQueryString(json = {}) {
    return Object.keys(json)
      .map(key => (json[key] || json[key] === 0 ? `${key}=${json[key]}` : ""))
      .filter(item => item)
      .join("&");
  }
  _fetchWithRetry(input, init) {
    let count = 0;
    return Rx.Observable
      .defer(() =>
        Rx.Observable.fromPromise(
          fetch(input, init).then(resp => {
            if ((resp.status + '').startsWith('5')) throw resp;
            return resp;
          })
        )
      )
      .retryWhen(errors => {
        return errors.mergeMap(error => {
          if (++count > FetchHelper.MAX_RETRY) {
            return Rx.Observable.throw(error);
          } else {
            return Rx.Observable.of(error).delay(FetchHelper.RETRY_DELAY);
          }
        });
      })
      .toPromise()
      .then(
        resp => resp,
        resp => {
          if (resp.status === 500) return resp;
          throw resp;
        }
      );
  }
  async fetch(input, init = {}) {
    let initWithDefaultHeaders = {
      ...init,
      headers: mergeWithDefaultHeaders(init.headers, this.defaultHeaders)
    };
    let beforeRequestInterceptorsResult = applyBeforeRequestInterceptors(
      this.beforeRequestInterceptors,
      initWithDefaultHeaders
    );
    if (beforeRequestInterceptorsResult === false) {
      throw new Error(
        "Fetch Promise was canceled by interceptor before requested"
      );
    }
    let response;
    try {
      if (FetchHelper.RETRY && (!init.method || init.method.toUpperCase() === "GET")) {
        response = await this._fetchWithRetry(input, initWithDefaultHeaders);
      } else {
        response = await fetch(input, initWithDefaultHeaders);
      }
    } catch (e) {
      console.error(e);
      applyAfterResponseInterceptors(e, this.afterResponseInterceptors);
      return [e, -1];
    }

    const responseStatus = response.status;
    let jsonData = null;
    try {
      jsonData = await response.json();
      let afterResponseInterceptorsResult = applyAfterResponseInterceptors(
        response,
        this.afterResponseInterceptors,
        jsonData
      );
      if (afterResponseInterceptorsResult === false) {
        throw new Error(
          "Fetch Promise was canceled by interceptor after responded"
        );
      }
      return [jsonData, responseStatus];
    } catch (e) {
      if (!jsonData) {
        let afterResponseInterceptorsResult = applyAfterResponseInterceptors(
          response,
          this.afterResponseInterceptors,
          jsonData,
          initWithDefaultHeaders
        );
        if (afterResponseInterceptorsResult === false) {
          throw new Error(
            "Fetch Promise was canceled by interceptor after responded"
          );
        }
      }
      Logger.warn(
        `Can not parse json from response of API "${input}" with code ${responseStatus}.`,
        e
      );
      return [response, responseStatus];
    }
  }
  uploadFile(url, opts = {}, onProgress) {
    return new Promise((res, rej) => {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method || "post", url);
      const headers = mergeWithDefaultHeaders(
        opts.headers,
        this.defaultHeaders
      );
      for (var k in headers) xhr.setRequestHeader(k, headers[k]);
      xhr.onload = e => {
        try {
          const json = JSON.parse(e.target.responseText);
          res([json, xhr.status]);
        } catch (err) {
          res([e.target.responseText, xhr.status]);
        }
      };
      xhr.onerror = rej;
      if (xhr.upload && onProgress) xhr.upload.onprogress = onProgress; // event.loaded / event.total * 100 ; //event.lengthComputable
      xhr.send(opts.body);
    });
  }
  getHeader() {
    return this.defaultHeaders;
  }
}

/*** PRIVATE METHODS: ***/

function mergeWithDefaultHeaders(headers = {}, defaultHeaders) {
  var headerObj = {};
  if (headers instanceof Headers) {
    for (let [key, value] of headers) {
      headerObj[key] = value;
    }
  } else {
    headerObj = headers;
  }

  return Object.assign({}, defaultHeaders, headers);
}

function applyBeforeRequestInterceptors(interceptors, initWithDefaultHeaders) {
  for (let interceptor of interceptors) {
    try {
      const interceptorResult = interceptor(initWithDefaultHeaders);
      if (interceptorResult === false) {
        console.error(
          "Interceptor ",
          interceptor,
          " has cancel signal. This makes the request stop immediately."
        );
        return false;
      }
    } catch (e) {
      console.error(`[FetchHelper] Error from interceptor ${interceptor}`, e);
      return false;
    }
  }
  //interceptors.forEach(interceptor => interceptor())
}

function applyAfterResponseInterceptors(response, interceptors, jsonData, initWithDefaultHeaders) {
  for (let interceptor of interceptors) {
    try {
      const interceptorResult = interceptor(response, jsonData, initWithDefaultHeaders);
      if (interceptorResult === false) {
        console.error(
          "Interceptor ",
          interceptor,
          " has cancel signal. This makes the request stop immediately."
        );
        return false;
      }
    } catch (e) {
      console.error(`[FetchHelper] Error from interceptor ${interceptor}`, e);
      return false;
    }
  }
}

const fetchHelperInstance = new FetchHelper();

export default fetchHelperInstance;
