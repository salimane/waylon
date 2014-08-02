require 'waylon/errors'
class Waylon
  class Job

    attr_reader :name
    attr_reader :client
    attr_reader :job_details

    def initialize(name, client)
      @name   = name
      @client = client

      @job_details = {}
    end

    def query!
      @job_details = client.job.list_details(@name)
      self
    rescue JenkinsApi::Exceptions::NotFound
      raise Waylon::Errors::NotFound
    end

    def status
      @client.job.color_to_status(@job_details['color'])
    end

    def est_duration
      # estimatedDuration is returned in ms and here we convert it to seconds
      client.api_get_request("/job/#{@name}/lastBuild", nil, '/api/json?depth=1&tree=estimatedDuration')['estimatedDuration'] / 1000
    end

    def progress_pct
      # Note that 'timestamp' available the Jenkins API is returned in ms
      start_time = client.api_get_request("/job/#{@name}/lastBuild", nil, '/api/json?depth=1&tree=timestamp')['timestamp'] / 1000.0
      progress_pct = ((Time.now.to_i - start_time) / est_duration) * 100
      return progress_pct.floor
    rescue JenkinsApi::Exceptions::InternalServerError
      -1
    end

    def eta
      # A build's 'duration' in the Jenkins API is only available
      # after it has completed. Using estimatedDuration and the
      # executor progress (in percentage), we can calculate the ETA.
      if progress_pct != -1 then
        t = (est_duration - (est_duration * (progress_pct / 100.0)))
        mm, ss = t.divmod(60)
        return "#{mm}m #{ss.floor}s"
      else
        -1
      end
    end

    def under_investigation?
      # Assume the job is in the failed state.

      last_build_descr = @client.job.get_build_details(@name, last_build_num)['description']

      !!(last_build_descr =~ /under investigation/i)
    end

    def last_build_num
      job_details['lastBuild']['number']
    end

    def to_hash
      {
        'name'         => @name,
        'url'          => @job_details['url'],
        'status'       => status,
        'progress_pct' => (progress_pct if status == 'running'),
        'eta'          => (eta if status == 'running'),
        'health'       => @job_details['healthReport'][0]['score'],
        'weather'      => weather(@job_details['healthReport'][0]['score']),
      }.reject{ |k, v| v.nil? }
    end

    private

    # weather() returns an img src, alt, and title, based on build stability
    def weather(score)
      case score.to_i
      when 100
        {
          'src' => '/img/sun.png',
          'alt' => '[sun]',
          'title' => 'No recent builds failed'
        }
      when 80
        {
          'src' => '/img/cloud.png',
          'alt' => '[cloud]',
          'title' => '1 of the last 5 builds failed'
        }
      else
        {
          'src' => '/img/umbrella.png',
          'alt' => '[umbrella]',
          'title' => '2 or more of the last 5 builds failed'
        }
      end
    end

  end
end