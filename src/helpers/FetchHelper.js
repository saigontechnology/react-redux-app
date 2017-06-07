import Logger from './Logger'
import download from './download'

/**
 *  Wrapper for Fetch API (https://developer.mozilla.org/en/docs/Web/API/Fetch_API)
 *  Inspired by Angular 1's $http service.
 *  Support setup default headers and interceptors.
 *  Future note: Consider using service worker instead of this for more standard solution.
 *  Usage (see each method below for more details):
 *      fetchHelperInstance.fetch( *the same parameters as Fetch API* )
 *      .then(...)
 *      .catch(...)
 */
class FetchHelper {
    constructor() {
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        }
        this.beforeRequestInterceptors = []
        this.afterResponseInterceptors = []
    }

    /**
     *  Add default header to each Fetch request.
     */
    addDefaultHeader(key, value) {
        this.defaultHeaders[key] = value
    }
    /**
     *  Remove default header
     */
    removeDefaultHeader(key) {
        delete this.defaultHeaders[key]
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
        this.beforeRequestInterceptors.push(interceptor)
        return () => {
            const index = this.beforeRequestInterceptors.indexOf(interceptor)
            this.beforeRequestInterceptors.splice(index, 1)
        }
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
        this.afterResponseInterceptors.push(interceptor)
        return () => {
            const index = this.afterResponseInterceptors.indexOf(interceptor)
            this.afterResponseInterceptors.splice(index, 1)
        }
    }

    /**
     *  Wrapper for fetch() API. Inspired by Angular's $http service.
     *  Usage:
     *      FetchHelper.fetch('api/something/somewhere', configs) //same parameters as Fetch API
     *      .then(([data, status]) => {
     *          //Handle when response status is in range [200, 300)
     *          //Params:
     *          //  data: json object
     *          //  status: 2XX
     *      }, ([data, status]) => {
     *          //Handle when response status is not in rage [200, 300)
     *          //Params:
     *          //  data: json object
     *          //  status: XXX or -1 if parse JSON fail from server response
     *      })
     */
    fetch(input, init = {}) {
        let initWithDefaultHeaders = {
            ...init,
            headers: mergeWithDefaultHeaders(init.headers, this.defaultHeaders)
        }
        applyBeforeRequestInterceptors(this.beforeRequestInterceptors)
        return new Promise((resolve, reject) => {
            let responseStatus
            fetch.apply(null, [input, initWithDefaultHeaders])
            .then(response => {
                let interceptorsResult = applyAfterResponseInterceptors(response, this.afterResponseInterceptors)
                if (interceptorsResult === false) {
                    responseStatus = -1
                    throw new Error('Fetch Promise was canceled by interceptor')
                } else {
                    // Do sth before resolve or reject to the outside:
                    responseStatus = response.status;
                    if (responseStatus >= 200 && responseStatus < 300) {
                        return response.json()
                    } else {
                        throw response
                    }
                }
            }).then(json => {
                // Resolve json from server success response
                resolve([json, responseStatus])

            }).catch(response => {
                if (response.json) {
                    response.json().then(json => {
                        // Reject json from server error response
                        reject([json, responseStatus])
                    }).catch(err => {
                        reject([err, -1])
                        Logger.log(err)
                    })
                } else {
                    Logger.log(response)
                    reject([response, -1])
                }
            })
        })
    }
    //GET FILE
    fetchFile(input, init = {}, fileName = 'rpt_Payroll', fileType = 'xls'){
        let initWithDefaultHeaders = {
            ...init,
            headers: mergeWithDefaultHeaders(init.headers, this.defaultHeaders)
        }
        applyBeforeRequestInterceptors(this.beforeRequestInterceptors)
        return new Promise((resolve, reject) => {
            let responseStatus
            fetch.apply(null, [input, initWithDefaultHeaders])
                .then(response => {
                    let interceptorsResult = applyAfterResponseInterceptors(response, this.afterResponseInterceptors)
                    if (interceptorsResult === false) {
                        responseStatus = -1
                        throw new Error('Fetch Promise was canceled by interceptor')
                    } else {
                        // Do sth before resolve or reject to the outside:
                        responseStatus = response.status;
                        if (responseStatus >= 200 && responseStatus < 300) {
                            return response.blob()
                        } else {
                            throw response
                        }
                    }
                }).then(blob => {
                    let file = fileName + "_" + getFormattedDate() + "." + fileType
                    download(blob, file, "application/octet-stream")
                    // Resolve json from server success response
                    resolve([blob, responseStatus])
                }, () => {
                    reject([response, -1])
                })
        })
    }

    getHeader(){
        return this.defaultHeaders;
    }
}

/*** PRIVATE METHODS: ***/

function mergeWithDefaultHeaders(headers = {}, defaultHeaders) {
    var headerObj = {}
    if (headers instanceof Headers) {
        for (let [key, value] of headers) {
            headerObj[key] = value
        }
    } else {
        headerObj = headers
    }

    return Object.assign({}, defaultHeaders, headers)
}

function applyBeforeRequestInterceptors(interceptors) {
    interceptors.forEach(interceptor => interceptor())
}

function applyAfterResponseInterceptors(response, interceptors) {
    for (let interceptor of interceptors) {
        if (interceptor(response) === false) return false
    }
}

function getFormattedDate() {
    var d = new Date();
    d = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
    return d;
}

const fetchHelperInstance = new FetchHelper()

export default fetchHelperInstance
